'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var dns = require('dns');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
// mongoose.connect(process.env.DB_URI);
mongoose.connect(process.env.MONGO_URI,{ useNewUrlParser: true, useUnifiedTopology: true });

var Schema = mongoose.Schema;

var shortUrlSchema = new Schema({
  original_url: { type: String, required: true },
  short_url: Number
});

var ShortUrl = mongoose.model('ShortUrl', shortUrlSchema);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// Read the POST request
app.post('/api/shorturl/new', function(req, res) {
  console.log('----------------------- POST REQUEST -----------------------');
  const errMsg = { error: 'invalid URL' };
  const regexp = /^(http(s?):\/\/(www\.){1}(\w+\.\w{2,}){1}(\.\w{2,}){0,2}(\/\w*)*)$/i;

  // Check if url already exists in db
  console.log('requested url: ', req.body.url);

  ShortUrl.find({ original_url: req.body.url }, function(err, docs) {
    if (err) return console.error('error: ', err);
    console.log('docs: ', docs);
    if (docs.length > 0) {
      console.log(
        'The requested url exists alreay in the db, returning the respective short_url.'
      );
      return res.json({
        original_url: docs[0].original_url,
        short_url: docs[0].short_url
      });
    } else {
      // Check if the url matches a valid pattern
      if (!regexp.test(req.body.url)) {
        return res.json(errMsg);
      } else {
        const reg = /^http(s?):\/\//i;
        let str = req.body.url;

        str = str.replace(reg, '');

        // check if dns exists for the url
        dns.lookup(str, function(err, addr) {
          console.log('looking up: ', str);
          if (err) {
            console.log('lookup Error: ', err);
            return res.json(errMsg);
          } else {
            // if url ok, add it to the db
            console.log('lookup addr: ', addr);

            // get the max short_url from the db
            ShortUrl.find()
              .sort({ short_url: -1 })
              .limit(1)
              .exec(function(err, doc) {
                if (err) return console.error(err);

                const short_url = doc[0] ? doc[0].short_url + 1 : 1;
                const to_db = {
                  original_url: req.body.url,
                  short_url: short_url
                };
                const new_doc = new ShortUrl(to_db);

                new_doc.save(function(err, doc) {
                  if (err) return console.error(err);
                  console.log(
                    doc.original_url + ' saved to shortUrl collection.'
                  );
                  return res.json({
                    original_url: doc.original_url,
                    short_url: doc.short_url
                  });
                });
              });
          }
        });
      }
    }
  });
});

// Redirect the short url to the original url when requested
app.get('/api/shorturl/:short_url', function(req, res) {
  console.log('----------------------- GET REQUEST -----------------------');
  ShortUrl.find({ short_url: Number(req.params.short_url) }, function(
    err,
    data
  ) {
    console.log('mongoDb lookup: ', req.params.short_url);
    if (err) return console.error(err);
    console.log('mongoDb result: ', data);
    return res.redirect(data[0].original_url);
  });
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});