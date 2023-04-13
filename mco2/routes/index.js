var express = require('express');
var router = express.Router();
var mysql = require('mysql2');

var sqlcon = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "password",
  database: "imdb_main",
  port: '3306',
  connectionLimit: 10
});

var node2 = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "password",
  database: "node2",
  port: '3306',
  connectionLimit: 10
});

var node3 = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "password",
  database: "node3",
  port: '3306',
  connectionLimit: 10
});


sqlcon.connect(function (err) {
  if (err) throw err;
  console.log("main node Connected!");
});
node2.connect(function (err) {
  if (err) throw err;
  console.log("node 2 Connected!");
});
node3.connect(function (err) {
  if (err) throw err;
  console.log("node 3 Connected!");
});

/* GET home page. */
router.get('/', function (req, res) {

  var sql = "SELECT * FROM movies LIMIT 5";

  sqlcon.query(sql, function (err, result) {
    if (err) throw err;
    movieList = result;

    res.render('index', { title: 'Express', movieList });

  });


});



router.post('/', async (req, res) => {
  var data = req.body;
  var select_sql;
  var movie_id;


  sqlcon.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");

    select_sql = `SELECT MAX(movie_id) as maxID FROM movies;`;

    sqlcon.query(select_sql, function (err, result) {
      if (err) throw err;
      movie_id = result[0].maxID + 1;
      var sql = `INSERT INTO movies (movie_id, movie_name, movie_year, movie_rank) VALUES ('${movie_id}', '${data.name}', '${data.year}', '${data.rank}')`;

      sqlcon.query(sql, function (err, result) {
        if (err) throw err;
        console.log("1 record inserted");
      });

      if (data.year < 1980) {


        if (err) throw err;
        console.log("Connected!");

        node2.query(sql, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted in node 2");
        });



      }

      else {


        if (err) throw err;
        console.log("Connected!");

        node3.query(sql, function (err, result) {
          if (err) throw err;
          console.log("1 record inserted in node 3");
        });



      }

    });




  });

  res.redirect('/')
});

router.get('/movies/search/', function (req, res) {

  if (req.query.year == "") {
    var sql = `SELECT * FROM movies;`
  }
  else {
    var { year } = req.query;
    var sql = `SELECT * FROM movies WHERE movie_year = ${year};`;
  }

  sqlcon.query(sql, function (err, result) {
    if (err) throw err;
    movieList = result;

    res.render('index', { title: 'Express', movieList });

  });
});



router.get('/edit/:movie_id', async (req, res) => {
  var { movie_id } = req.params;
  console.log(`id is: ${movie_id}`)

  sqlcon.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");

    var sql = `SELECT * FROM movies WHERE movie_id = ${movie_id};`;


    sqlcon.query(sql, function (err, result) {
      if (err) throw err;

      res.render('edit', { data: result[0] });


    });

  });
});

router.post('/edit/:movie_id', async (req, res) => {
  var { movie_id } = req.params;
  var data = req.body;

  sqlcon.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");

    var sql = `UPDATE movies SET movie_name = '${data.name}', movie_year = '${data.year}', movie_rank = '${data.rank}' WHERE movie_id = ${movie_id};`;


    sqlcon.query(sql, function (err, result) {
      if (err) throw err;
      console.log('successfully updated');

      if (result.movie_year < 1980) {

        node2.query(sql, function (err, result) {
          if (err) throw err;
          console.log('successfully updated in node 2');

        });

      }
      else {
        node3.query(sql, function (err, result) {
          if (err) throw err;
          console.log('successfully updated in node 3');

        });
      }

    });

  });
  res.redirect('/');
});

router.post('/delete/:movie_id', async (req, res) => {
  var { movie_id } = req.params;
  var data = req.body;

  sqlcon.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");

    var sql = `DELETE FROM movies WHERE movie_id = ${movie_id};`;


    sqlcon.query(sql, function (err, result) {
      if (err) throw err;
      console.log('successfully deleted');

      if (result.movie_year < 1980) {

        node2.query(sql, function (err, result) {
          if (err) throw err;
          console.log('successfully deleted in node 2');

        });

      }
      else {
        node3.query(sql, function (err, result) {
          if (err) throw err;
          console.log('successfully deleted in node 3');

        });
      }
    });



  });
  res.redirect('/');
});






module.exports = router;
