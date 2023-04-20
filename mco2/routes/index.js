var express = require('express');
var router = express.Router();
var mysql = require('mysql2');

const UNCOMMITTED = "READ UNCOMMITTED";
const COMMITTED = "READ COMMITTED";
const REPEATABLE = "REPEATABLE READ";
const SERIALIZABLE = "SERIALIZABLE";


var isolation = REPEATABLE;

var sqlcon = mysql.createConnection({
  host: "10.76.195.113",
  user: "newuser",
  password: "March292014!",
  database: "imdb_main",
  port: '3306',
  connectionLimit: 10
});

var node2 = mysql.createConnection({
  host: "10.224.212.138",
  user: "root",
  password: "DonnielleA14",
  database: "node2",
  port: '3306',
  connectionLimit: 10
});

var node3 = mysql.createConnection({
  host: "10.76.195.113",
  user: "root",
  password: "March292014!",
  database: "node3",
  port: '3306',
  connectionLimit: 10
});

var mainOnline = connectSQLMain();
var node2Online = connectSQLNode2();
var node3Online = connectSQLNode3();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function recovery(node, other_node) {

  var sql = `SELECT MAX(transaction_id) as maxID FROM logs`;

  var done = node.query(sql, function (err, result) {
    var currMaxID = result[0].maxID;

    other_node.query(sql, function (err, result) {

      var otherMaxID = result[0].maxID;
      console.log(`this is result: ${result[0].maxID}`);

      //recovery will only start if this condition is met
      if (otherMaxID > currMaxID) {
        var diff = otherMaxID - currMaxID;
        var currID = currMaxID + 1;
        console.log(`this is diff: ${diff}`);

        if (node == sqlcon) {
          for (let i = 0; i < diff; i++) {
            var recovery_logs_sql = `SELECT * FROM logs WHERE transaction_id = '${currID}'`;
            console.log(`this is currID: ${currID}`);

            other_node.query(recovery_logs_sql, function (err, result) {
              if (result[0].transaction_type == 'UPDATE') {
                var recovery_main_sql = `UPDATE movies SET movie_name = '${result[0].movie_name}', movie_year = '${result[0].movie_year}', movie_rank = '${result[0].movie_rank}' WHERE movie_id = ${result[0].movie_id}; `;

                node.query(recovery_main_sql, function (err, reuslt) {
                  if (err) throw err;

                  console.log(`recovery instance ${i} updated.`);
                })

                var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${result[0].transaction_id}', '${result[0].old_year}', '${result[0].movie_id}', '${result[0].movie_name}', '${result[0].movie_year}', '${result[0].movie_rank}', '${result[0].transaction_type}')`;


                node.query(logs_sql, function (err, result) {
                  if (err) throw err;
                  console.log('successfully inserted to main node logs');
                })
              }
              //else if type is delete
              else {
                var recovery_main_sql = `DELETE FROM movies WHERE movie_id = ${result[0].movie_id}; `;

                node.query(recovery_main_sql, function (err, reuslt) {
                  if (err) throw err;

                  console.log(`recovery instance ${i} deleted.`);
                })
                var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${result[0].transaction_id}', NULL, '${result[0].movie_id}', NULL, NULL, NULL, '${result[0].transaction_type}')`;


                node.query(logs_sql, function (err, result) {
                  if (err) throw err;
                  console.log('successfully inserted to main node logs');
                })
              }

            })

            currID += 1;
          }
          return true;
        }
        //node 2 and node 3 recovery
        else {
          for (let i = 0; i < diff; i++) {
            var recovery_logs_sql = `SELECT * FROM logs WHERE transaction_id = '${currID}'`;
            console.log(`this is currID: ${currID}`);

            other_node.query(recovery_logs_sql, function (err, result) {
              console.log(`this is result: ${result.transaction_type}`);
              if (result[0].transaction_type == 'UPDATE') {
                var insert_sql = `INSERT INTO movies(movie_id, movie_name, movie_year, movie_rank) VALUES('${result[0].movie_id}', '${result[0].movie_name}', '${result[0].movie_year}', '${result[0].movie_rank}')`;
                var delete_sql = `DELETE FROM movies WHERE movie_id = ${result[0].movie_id}; `;
                var recovery_main_sql = `UPDATE movies SET movie_name = '${result[0].movie_name}', movie_year = '${result[0].movie_year}', movie_rank = '${result[0].movie_rank}' WHERE movie_id = ${result[0].movie_id}; `;

                if (result[0].movie_year < 1980 && result[0].old_year >= 1980) {

                  if (node == node2) {
                    node.query(insert_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted the updated data in node 2');

                    });
                  }

                  else {
                    node.query(delete_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully deleted preexisting data in node 3');

                    });
                  }

                }
                else if (result[0].movie_year >= 1980 && result[0].old_year < 1980) {

                  if (node == node3) {
                    node.query(insert_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted the updated data in node 3');

                    });
                  }

                  else {
                    node.query(delete_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully deleted preexisting data in node 2');

                    });
                  }

                }

                else if (result[0].movie_year < 1980) {

                  node.query(recovery_main_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully updated in node 2');

                  });

                }
                else {
                  node.query(recovery_main_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully updated in node 3');

                  });
                }

                var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${result[0].transaction_id}', '${result[0].old_year}', '${result[0].movie_id}', '${result[0].movie_name}', '${result[0].movie_year}', '${result[0].movie_rank}', '${result[0].transaction_type}')`;


                node.query(logs_sql, function (err, result) {
                  if (err) throw err;
                  console.log('successfully inserted to node 2 or node 3 logs');
                })



              }
              //else if type is delete
              else {
                var recovery_main_sql = `DELETE FROM movies WHERE movie_id = ${result[0].movie_id}; `;

                if (result[0].movie_year < 1980 && node == node2) {
                  node.query(recovery_main_sql, function (err, reuslt) {
                    if (err) throw err;

                    console.log(`recovery instance ${i} deleted.`);
                  })
                }
                else {
                  node.query(recovery_main_sql, function (err, reuslt) {
                    if (err) throw err;

                    console.log(`recovery instance ${i} deleted.`);
                  })
                }
                var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${result[0].transaction_id}', NULL, '${result[0].movie_id}', NULL, NULL, NULL, '${result[0].transaction_type}')`;


                node.query(logs_sql, function (err, result) {
                  if (err) throw err;
                  console.log('successfully inserted to node 2 or node 3 logs');
                })

              }

            })


            currID += 1;
          }
          return true;
        }
      }
    })
  })




  return new Promise((resolve) => setTimeout(resolve, 200));


}

async function recovery_strategy(main, node2Status, node3Status) {

  if (main) {
    if (node2Status) {
      recovery(sqlcon, node2);
    }
    else if (node3Status) {
      recovery(sqlcon, node3);
    }
  }

  if (node2Status) {
    if (main) {
      recovery(node2, sqlcon);
    }
    else if (node3Status) {
      recovery(node2, node3);
    }
  }

  if (node3Status) {
    if (main) {
      recovery(node3, sqlcon);
    }
    else if (node2Status) {
      recovery(node3, node2);
    }
  }

  return new Promise((resolve) => setTimeout(resolve, 200));
}

function connectSQLMain() {
  var bool = sqlcon.connect(function (err) {
    if (err) {
      console.log("main node not connected");
      return false;
    }
    console.log("main node Connected!");
    return true;
  });
  return bool;
};

function connectSQLNode2() {
  var bool = node2.connect(function (err) {
    if (err) {
      console.log("node 2 not connected");
      throw err;
      return false;
    }
    console.log("node 2 Connected!");
    return true;
  });
  return bool;
};

function connectSQLNode3() {
  var bool = node3.connect(function (err) {
    if (err) {
      console.log("node 3 not connected");
      return false;
    }
    console.log("node 3 Connected!");
    return true;
  });
  return bool;
};

/* GET home page. */
router.get('/', async (req, res) => {

  var sql = `SELECT * FROM movies`;

  var mainOnline = false;
  var node2Online = false;
  var node3Online = false;

  mainOnline = connectSQLMain();
  node2Online = connectSQLNode2();
  node3Online = connectSQLNode3();

  await recovery_strategy(mainOnline, node2Online, node3Online);


  if (mainOnline) {
    await sqlcon.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
    sqlcon.beginTransaction();
    sqlcon.query(sql, function (err, result) {
      if (err) throw err;
      movieList = result;
      sqlcon.commit();
      res.render('index', { title: 'Express', movieList });

    });
  }
  else {
    await node2.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
    await node3.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
    node2.beginTransaction();
    node3.beginTransaction();
    node2.query(sql, function (err, result) {
      if (err) throw err;
      var movieList = [];
      movieList.push.apply(movieList, result);
      node3.query(sql, function (err, result) {
        if (err) throw err;
        movieList.push.apply(movieList, result);

        node2.commit();
        node3.commit();
        res.render('index', { title: 'Express', movieList });

      });

    });

  }

});



router.post('/', async (req, res) => {
  var data = req.body;
  var select_sql;
  var movie_id;

  var mainOnline = false;
  var node2Online = false;
  var node3Online = false;

  mainOnline = connectSQLMain();
  node2Online = connectSQLNode2();
  node3Online = connectSQLNode3();

  await recovery_strategy(mainOnline, node2Online, node3Online);


  select_sql = `SELECT MAX(movie_id) as maxID FROM movies; `;

  sqlcon.query(select_sql, function (err, result) {
    if (err) throw err;
    movie_id = result[0].maxID + 1;
    var sql = `INSERT INTO movies(movie_id, movie_name, movie_year, movie_rank) VALUES('${movie_id}', '${data.name}', '${data.year}', '${data.rank}')`;

    if (mainOnline) {
      sqlcon.query(sql, function (err, result) {
        if (err) throw err;
        console.log("1 record inserted");
      });
    }

    if (data.year < 1980) {

      if (node2Online) {
        node2.query(sql, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted in node 2");
        });
      }

    }

    else {

      if (node3Online) {
        node3.query(sql, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted in node 3");
        });
      }

    }

  });




  res.redirect('/')
});

router.get('/movies/search/', async (req, res) => {

  var mainOnline = false;
  var node2Online = false;
  var node3Online = false;

  mainOnline = connectSQLMain();
  node2Online = connectSQLNode2();
  node3Online = connectSQLNode3();

  if (req.query.isolation) {
    isolation = req.query.isolation;
  }

  await recovery_strategy(mainOnline, node2Online, node3Online);

  if (req.query.year == "") {
    var sql = `SELECT * FROM movies; `
  }
  else {
    var { year } = req.query;
    var sql = `SELECT * FROM movies WHERE movie_year = ${year}; `;
  }

  if (mainOnline) {
    await sqlcon.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
    sqlcon.beginTransaction();
    sqlcon.query(sql, function (err, result) {
      if (err) throw err;
      movieList = result;
      sqlcon.commit();
      res.render('index', { title: 'Express', movieList });

    });
  }
  else {
    if (req.query.year == "") {
      await node2.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      await node3.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      node2.beginTransaction();
      node3.beginTransaction();
      node2.query(sql, function (err, result) {
        if (err) throw err;
        var movieList = [];
        movieList.push.apply(movieList, result);
        node3.query(sql, function (err, result) {
          if (err) throw err;
          movieList.push.apply(movieList, result);

          node2.commit();
          node3.commit();
          res.render('index', { title: 'Express', movieList });

        });
      });
    }
    else if (year >= 1980) {
      await node3.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      node3.beginTransaction();
      node3.query(sql, function (err, result) {
        if (err) throw err;
        movieList = result;
        node3.commit();
        res.render('index', { title: 'Express', movieList });

      });
    }
    else if (year < 1980) {
      await node2.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      node2.beginTransaction();
      node2.query(sql, function (err, result) {
        if (err) throw err;
        movieList = result;
        node2.commit();
        res.render('index', { title: 'Express', movieList });

      });
    }
  }
});




router.get('/edit/:movie_id', async (req, res) => {
  var { movie_id } = req.params;
  console.log(`id is: ${movie_id} `)

  var mainOnline = false;
  var node2Online = false;
  var node3Online = false;

  mainOnline = connectSQLMain();
  node2Online = connectSQLNode2();
  node3Online = connectSQLNode3();

  await recovery_strategy(mainOnline, node2Online, node3Online);


  var sql = `SELECT * FROM movies WHERE movie_id = ${movie_id}; `;

  if (mainOnline) {
    sqlcon.query(sql, function (err, result) {
      if (err) throw err;

      res.render('edit', { data: result[0] });

    });
  }
  else {
    node2.query(sql, function (err, result) {
      if (err) throw err;

      if (result[0] != undefined) {
        res.render('edit', { data: result[0] });
      }
      else {
        node3.query(sql, function (err, result) {
          if (err) throw err;

          res.render('edit', { data: result[0] });
        })
      }

    });
  }

});

router.post('/edit/:movie_id', async (req, res) => {
  var { movie_id } = req.params;
  var data = req.body;
  var transaction_id;
  var sql = `UPDATE movies SET movie_name = '${data.name}', movie_year = '${data.year}', movie_rank = '${data.rank}' WHERE movie_id = ${movie_id}; `;
  var logs_select_sql = `SELECT MAX(transaction_id) as maxID FROM logs; `;
  var old_year_sql = `SELECT * FROM movies WHERE movie_id = ${movie_id}; `;
  var insert_sql = `INSERT INTO movies(movie_id, movie_name, movie_year, movie_rank) VALUES('${movie_id}', '${data.name}', '${data.year}', '${data.rank}')`;
  var delete_sql = `DELETE FROM movies WHERE movie_id = ${movie_id}; `;

  var mainOnline = false;
  var node2Online = false;
  var node3Online = false;

  mainOnline = connectSQLMain();
  node2Online = connectSQLNode2();
  node3Online = connectSQLNode3();

  await recovery_strategy(mainOnline, node2Online, node3Online);

  if (mainOnline) {

    await sqlcon.execute(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
    sqlcon.beginTransaction();
    sqlcon.query(logs_select_sql, async (err, result) => {


      sqlcon.query(old_year_sql, async (err, result) => {
        if (err) throw err;
        var old_year = result[0].movie_year;

        sqlcon.query(sql, async (err, result) => {
          if (err) throw err;
          if (req.body.sleep == 'sleep') {
            await sleep(10000);
          }

          console.log('successfully updated');

          if (data.year < 1980 && old_year >= 1980) {
            if (node2Online) {
              node2.beginTransaction();
              node2.query(insert_sql, function (err, result) {
                if (err) throw err;
                console.log('successfully inserted the updated data in node 2');

                node2.commit();

              });
            }
            if (node3Online) {

              node3.beginTransaction();
              node3.query(delete_sql, function (err, result) {
                if (err) throw err;
                console.log('successfully deleted preexisting data in node 3');

                node3.commit();

              });
            }
          }
          else if (data.year >= 1980 && old_year < 1980) {
            if (node3Online) {
              node3.beginTransaction();
              node3.query(insert_sql, function (err, result) {
                if (err) throw err;
                console.log('successfully inserted the updated data in node 3');

                node3.commit();
              });
            }
            if (node2Online) {
              node2.beginTransaction();
              node2.query(delete_sql, function (err, result) {
                if (err) throw err;
                console.log('successfully deleted preexisting data in node 2');

                node2.commit();
              });
            }
          }

          else if (data.year < 1980 && node2Online) {
            node2.beginTransaction();

            node2.query(sql, function (err, result) {
              if (err) throw err;
              console.log('successfully updated in node 2');
              node2.commit();
            });

          }
          else if (node3Online) {
            node3.beginTransaction();
            node3.query(sql, function (err, result) {
              if (err) throw err;
              console.log('successfully updated in node 3');

              node3.commit();
            });
          }



          sqlcon.commit();

        });

        await sleep(1000);

        sqlcon.query(logs_select_sql, async (err, result) => {

          transaction_id = result[0].maxID + 1;

          var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

          if (mainOnline) {
            sqlcon.query(logs_sql, function (err, result) {
              if (err) throw err;
              console.log('successfully inserted to main node logs');
            })
          }
          if (node2Online) {
            node2.query(logs_sql, function (err, result) {
              if (err) throw err;
              console.log('successfully inserted to node 2 logs');
            })
          }
          if (node3Online) {
            node3.query(logs_sql, function (err, result) {
              if (err) throw err;
              console.log('successfully inserted to node 3 logs');
            })
          }

        });


      });





    })
  }
  //main node is not online
  else {

    node2.query(logs_select_sql, function (err, result) {
      node2.query(old_year_sql, async (err, result) => {
        if (result[0] == undefined) {
          node3.query(old_year_sql, async (err, result) => {
            old_year = result[0].movie_year;

            if (data.year < 1980 && old_year >= 1980) {
              if (node2Online) {
                node2.query(insert_sql, function (err, result) {
                  if (err) throw err;
                  console.log('successfully inserted the updated data in node 2');
                  node3.query(delete_sql, async (err, result) => {
                    if (err) throw err;
                    console.log('successfully deleted preexisting data in node 3');


                    //update logs table
                    node2.query(logs_select_sql, async (err, result) => {

                      transaction_id = result[0].maxID + 1;

                      var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                      if (mainOnline) {
                        sqlcon.query(logs_sql, function (err, result) {
                          if (err) throw err;
                          console.log('successfully inserted to main node logs');
                        })
                      }
                      if (node2Online) {
                        node2.query(logs_sql, function (err, result) {
                          if (err) throw err;
                          console.log('successfully inserted to node 2 logs');
                        })
                      }
                      if (node3Online) {
                        node3.query(logs_sql, function (err, result) {
                          if (err) throw err;
                          console.log('successfully inserted to node 3 logs');
                        })
                      }
                    });

                  });

                });
              }
            }
            else if (data.year >= 1980 && old_year < 1980) {
              if (node3Online) {
                node3.query(insert_sql, async (err, result) => {
                  if (err) throw err;
                  console.log('successfully inserted the updated data in node 3');
                  node2.query(delete_sql, async (err, result) => {
                    if (err) throw err;
                    console.log('successfully deleted preexisting data in node 2');

                    //update logs table
                    node2.query(logs_select_sql, async (err, result) => {

                      transaction_id = result[0].maxID + 1;

                      var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                      if (mainOnline) {
                        sqlcon.query(logs_sql, function (err, result) {
                          if (err) throw err;
                          console.log('successfully inserted to main node logs');
                        })
                      }
                      if (node2Online) {
                        node2.query(logs_sql, function (err, result) {
                          if (err) throw err;
                          console.log('successfully inserted to node 2 logs');
                        })
                      }
                      if (node3Online) {
                        node3.query(logs_sql, function (err, result) {
                          if (err) throw err;
                          console.log('successfully inserted to node 3 logs');
                        })
                      }
                    });

                  });

                });
              }
            }

            else if (data.year < 1980 && node2Online) {

              node2.query(sql, async (err, result) => {
                if (err) throw err;
                console.log('successfully updated in node 2');

                //update logs table
                node2.query(logs_select_sql, async (err, result) => {

                  transaction_id = result[0].maxID + 1;

                  var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                  if (mainOnline) {
                    sqlcon.query(logs_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted to main node logs');
                    })
                  }
                  if (node2Online) {
                    node2.query(logs_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted to node 2 logs');
                    })
                  }
                  if (node3Online) {
                    node3.query(logs_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted to node 3 logs');
                    })
                  }
                });

              });

            }
            else if (node3Online) {
              node3.query(sql, async (err, result) => {
                if (err) throw err;
                console.log('successfully updated in node 3');


                //update logs table
                node2.query(logs_select_sql, async (err, result) => {

                  transaction_id = result[0].maxID + 1;

                  var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                  if (mainOnline) {
                    sqlcon.query(logs_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted to main node logs');
                    })
                  }
                  if (node2Online) {
                    node2.query(logs_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted to node 2 logs');
                    })
                  }
                  if (node3Online) {
                    node3.query(logs_sql, function (err, result) {
                      if (err) throw err;
                      console.log('successfully inserted to node 3 logs');
                    })
                  }
                });

              });
            }


          })
        }
        else {
          old_year = result[0].movie_year;

          if (data.year < 1980 && old_year >= 1980) {
            if (node2Online) {
              node2.query(insert_sql, function (err, result) {
                if (err) throw err;
                console.log('successfully inserted the updated data in node 2');
                node3.query(delete_sql, async (err, result) => {
                  if (err) throw err;
                  console.log('successfully deleted preexisting data in node 2');

                  //update logs table
                  node2.query(logs_select_sql, async (err, result) => {

                    transaction_id = result[0].maxID + 1;

                    var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                    if (mainOnline) {
                      sqlcon.query(logs_sql, function (err, result) {
                        if (err) throw err;
                        console.log('successfully inserted to main node logs');
                      })
                    }
                    if (node2Online) {
                      node2.query(logs_sql, function (err, result) {
                        if (err) throw err;
                        console.log('successfully inserted to node 2 logs');
                      })
                    }
                    if (node3Online) {
                      node3.query(logs_sql, function (err, result) {
                        if (err) throw err;
                        console.log('successfully inserted to node 3 logs');
                      })
                    }
                  });

                });

              });
            }
          }
          else if (data.year >= 1980 && old_year < 1980) {
            if (node3Online) {
              node3.query(insert_sql, function (err, result) {
                if (err) throw err;
                console.log('successfully inserted the updated data in node 3');
                node2.query(delete_sql, async (err, result) => {
                  if (err) throw err;
                  console.log('successfully deleted preexisting data in node 2');
                  //update logs table
                  node2.query(logs_select_sql, async (err, result) => {

                    transaction_id = result[0].maxID + 1;

                    var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                    if (mainOnline) {
                      sqlcon.query(logs_sql, function (err, result) {
                        if (err) throw err;
                        console.log('successfully inserted to main node logs');
                      })
                    }
                    if (node2Online) {
                      node2.query(logs_sql, function (err, result) {
                        if (err) throw err;
                        console.log('successfully inserted to node 2 logs');
                      })
                    }
                    if (node3Online) {
                      node3.query(logs_sql, function (err, result) {
                        if (err) throw err;
                        console.log('successfully inserted to node 3 logs');
                      })
                    }
                  });

                });

              });
            }
          }

          else if (data.year < 1980 && node2Online) {

            node2.query(sql, async (err, result) => {
              if (err) throw err;
              console.log('successfully updated in node 2');


              //update logs table
              node2.query(logs_select_sql, async (err, result) => {

                transaction_id = result[0].maxID + 1;

                var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                if (mainOnline) {
                  sqlcon.query(logs_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully inserted to main node logs');
                  })
                }
                if (node2Online) {
                  node2.query(logs_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully inserted to node 2 logs');
                  })
                }
                if (node3Online) {
                  node3.query(logs_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully inserted to node 3 logs');
                  })
                }
              });

            });

          }
          else if (node3Online) {
            node3.query(sql, async (err, result) => {
              if (err) throw err;
              console.log('successfully updated in node 3');

              //update logs table
              node2.query(logs_select_sql, async (err, result) => {

                transaction_id = result[0].maxID + 1;

                var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', '${old_year}', '${movie_id}', '${data.name}', '${data.year}', '${data.rank}', 'UPDATE')`;

                if (mainOnline) {
                  sqlcon.query(logs_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully inserted to main node logs');
                  })
                }
                if (node2Online) {
                  node2.query(logs_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully inserted to node 2 logs');
                  })
                }
                if (node3Online) {
                  node3.query(logs_sql, function (err, result) {
                    if (err) throw err;
                    console.log('successfully inserted to node 3 logs');
                  })
                }
              });

            });
          }
        }
      })

    })



  }
  if (req.body.sleep == 'sleep') {
    await sleep(10000);
    res.redirect('/');
  }
  else {
    await sleep(1000);
    res.redirect('/');
  }
});

router.post('/delete/:movie_id', async (req, res) => {
  var { movie_id } = req.params;
  var data = req.body;

  var mainOnline = false;
  var node2Online = false;
  var node3Online = false;

  mainOnline = connectSQLMain();
  node2Online = connectSQLNode2();
  node3Online = connectSQLNode3();

  await recovery_strategy(mainOnline, node2Online, node3Online);


  var select_sql = `SELECT * FROM movies WHERE movie_id = ${movie_id}; `;
  var sql = `DELETE FROM movies WHERE movie_id = ${movie_id}; `;

  if (mainOnline) {
    sqlcon.query(select_sql, function (err, result) {
      var movie_year = result[0].movie_year;
      sqlcon.query(sql, function (err, result) {
        if (err) throw err;
        console.log('successfully deleted');

        if (movie_year < 1980) {
          if (node2Online) {
            node2.query(sql, function (err, result) {
              if (err) throw err;
              console.log('successfully deleted in node 2');

            });
          }

        }
        else {
          if (node3Online) {
            node3.query(sql, function (err, result) {
              if (err) throw err;
              console.log('successfully deleted in node 3');

            });
          }
        }
      });
    });
  }
  else {
    node2.query(select_sql, function (err, result) {

      if (result[0] == undefined) {

        node3.query(sql, function (err, result) {
          if (err) throw err;
          console.log('successfully deleted in node 3');

        });

      }

      else {
        node2.query(sql, function (err, result) {
          if (err) throw err;
          console.log('successfully deleted in node 2');

        });
      }
    });
  }


  //inserting to logs table
  if (mainOnline) {
    var logs_select_sql = `SELECT MAX(transaction_id) as maxID FROM logs; `;
    var transaction_id;
    sqlcon.query(logs_select_sql, function (err, result) {
      transaction_id = result[0].maxID + 1;
      var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', null, '${movie_id}', null, null, null, 'DELETE')`;

      if (mainOnline) {
        sqlcon.query(logs_sql, function (err, result) {
          if (err) throw err;
          console.log('successfully inserted to main node logs');
        })
      }
      if (node2Online) {
        node2.query(logs_sql, function (err, result) {
          if (err) throw err;
          console.log('successfully inserted to node 2 logs');
        })
      }
      if (node3Online) {
        node3.query(logs_sql, function (err, result) {
          if (err) throw err;
          console.log('successfully inserted to node 3 logs');
        })
      }
    });
  }

  else {
    var logs_select_sql = `SELECT MAX(transaction_id) as maxID FROM logs; `;
    var transaction_id;
    node2.query(logs_select_sql, function (err, result) {
      transaction_id = result[0].maxID + 1;
      var logs_sql = `INSERT INTO logs(transaction_id, old_year, movie_id, movie_name, movie_year, movie_rank, transaction_type) VALUES('${transaction_id}', NULL, '${movie_id}', NULL, NULL, NULL, 'DELETE')`;

      if (mainOnline) {
        sqlcon.query(logs_sql, function (err, result) {
          if (err) throw err;
          console.log('successfully inserted to main node logs');
        })
      }
      if (node2Online) {
        node2.query(logs_sql, function (err, result) {
          if (err) throw err;
          console.log('successfully inserted to node 2 logs');
        })
      }
      if (node3Online) {
        node3.query(logs_sql, function (err, result) {
          if (err) throw err;
          console.log('successfully inserted to node 3 logs');
        })
      }
    });
  }



  res.redirect('/');
});






module.exports = router;
