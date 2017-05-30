const express = require('express');
const router = express.Router();
const MongoClient = require('mongodb').MongoClient
const geospacial = require('./geospacial.js');
const trailapi = require('./trailapi.js');
const weatherapi = require('./weather.js');
const bcrypt = require('bcrypt');

require('./env.js');  // comment out for production

MongoClient.connect('mongodb://localhost:27017/outdoor-activity-finder', (error,db) => {
  if (error) {
    console.log(error)
  } else {
    console.log('Database Connection Successful');
    const users = db.collection('users');
    const reviews = db.collection('reviews');

    router.get('/', (req, res) => {
      res.render('index', {title: 'Outdoor Activity Locator', user: res.locals.currentUser});
    });

    router.post('/', (req, res) => {
      let address;

      if (req.body.address && req.body.city && req.body.state) {
        address = req.body.address + "+" + req.body.city + "+" + req.body.state;
      } else {
        address = req.body.zip;
      }

      let activity = req.body.activity;
      let radius = req.body.radius;
      
      let getUserCoords = geospacial.getCoords(address);

      getUserCoords.then((coords) => {
        let startLat = coords.lat;
        let startLon = coords.lng;

        trailapi.getPlaces({lat: startLat, lon: startLon, activity: activity, radius: radius}).then((places) => {
          let origin = {latitude: startLat, longitude: startLon};
          
          for (let p = 0; p < places.places.length; p++) {
            let destination = {latitude: places.places[p].lat, longitude: places.places[p].lon};
            places.places[p].distance = geospacial.getDistance(origin,destination);
            for (let a = 0; a < places.places[p].activities.length; a++) {
              places.places[p].activities[a].description = trailapi.cleanDescription(places.places[p].activities[a].description)
            }
          }

          places = places.places.sort((a,b) => {
            return a.distance - b.distance;
          });

          res.status(200).render('places', {places: places, title: "Search Results",user: res.locals.currentUser});
          // res.status(200).json(places);
        });
      });
    });

    router.get('/place', (req, res) => {
      let total;
      let average;
      trailapi.getPlaces({lat: req.query.lat, lon: req.query.lon, radius: .01}).then((place) => {
        for (let a = 0; a < place.places[0].activities.length; a++) {
          place.places[0].activities[a].description = trailapi.cleanDescription(place.places[0].activities[a].description)
        }
        weatherapi.getWeather(req.query.lat,req.query.lon).then((weather) => {
          weather.main.temp = weather.main.temp.toFixed();
          weather.wind.speed = weather.wind.speed.toFixed();
          weather.wind.deg = weatherapi.convertToDirection(weather.wind.deg);
          reviews.find({unique_id: place.places[0].unique_id}).toArray((error,reviews) => {
            if (reviews[0] === undefined) {
              reviews = [{reviews: [{message: 'No reviews for this place yet.  Be the first to write a review!'}]}];
            } else {
              total = 0;
              for (let r = 0; r < reviews[0].reviews.length; r++) {
                total += reviews[0].reviews[r].rating;
              }
              average = total / reviews[0].reviews.length
            }
            res.status(200).render('place', {place: place.places[0], weather: weather, title: place.places[0].name, key: process.env.googleMapsAPIKey, reviews: reviews[0],user: res.locals.currentUser, average: average});
          });
        });
      });
    });

    router.post('/reviews', (req,res,next) => {
      let uniqueID = parseInt(req.body.uniqueID);
      let rating = parseInt(req.body.rating);
      let referringUrl = '/place?lat=' + req.body.lat + '&lon=' + req.body.lon;
      // reviews.find({unique_id:uniqueID}).toArray((error,review) => {
        if (req.body.noReviews) {
          reviews.insert({name:req.body.placeName,unique_id:uniqueID,reviews:[{username: res.locals.currentUser,rating: rating,description: req.body.description, date: new Date()}]},(error,result) => {
            if (error) {
              return next(error);
            } else {
              console.log(result);
              res.redirect(referringUrl);
            }
          });
        } else {
          reviews.update({unique_id:uniqueID},{$push: {reviews: {username: res.locals.currentUser,rating: rating,description: req.body.description, date: new Date()}}},(error,result) => {
            if (error) {
              return next(error);
            } else {
              console.log(result);
              res.redirect(referringUrl);
            }
          });
        }
      // });
    });

    router.get('/login', (req,res) => {
      res.render('login', {title: 'login'});
    });

    router.post('/login', (req,res,next) => {
      users.find({username: req.body.username}).toArray((error,user) => {
        if (error) {
          return next(error);
        } else if (user[0] === undefined) {
          console.log('user not found');
        } else {
          bcrypt.compare(req.body.password, user[0].password , function(error, result) {
            if (result === false) {
              console.log('incorrect password');
            } else {
              req.session.username = user[0].username;
              req.session.usertype = user[0].type;
              res.redirect('/');
            }
          });
        }
      });
    });

    router.get('/logout', (req, res, next) => {
      if (req.session) {
        // delete session object
        req.session.destroy((error) => {
          if(error) {
            return next(error);
          } else {
            res.redirect('/');
          }
        });
      }
    });

    router.get('/signup', (req,res) => {
      res.render('signup', {title: 'Sign Up'});
    });

    router.post('/signup', (req,res,next) => {
      users.find({username: req.body.username}).toArray((error,user) => {
        if (user[0] !== undefined) {
          return console.log('username already exists'); // eventually res.send
        } else {
          users.find({email: req.body.email}).toArray((error,user) => {
            if (user[0] !== undefined) {
              return console.log('that email is already associated with an existing user'); // eventually res.send
            } else {
              if (req.body.password !== req.body.confirmPassword) {
                return console.log('passwords do not match');
              } else {
                bcrypt.hash(req.body.password, 10, (error, hash) => {
                  if (error) {
                    return next(error);
                  } else {
                    req.body.password = hash;
                    users.insert({username: req.body.username, password: req.body.password, type: 'user', email: req.body.email, joined_on: new Date()}, (error,result) => {
                      if (error) {
                        return next(error);
                      } else {
                        console.log(result);
                        req.session.username = req.body.username;
                        req.session.usertype = 'user';
                        res.redirect('/')
                      }
                    });
                  }
                });
              }
            }
          });
        }
      });
    });

  }
});

module.exports = router;