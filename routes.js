const express = require('express');
const router = express.Router();
const geospacial = require('./geospacial.js');
const trailapi = require('./trailapi.js');

router.get('/', (req, res, next) => {
  res.render('index');
});

router.post('/', (req, res, next) => {
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
        places.places[p].distance = geospacial.getDistance(origin,destination)
      }

      places = places.places.sort((a,b) => {
        return a.distance - b.distance;
      });

      res.status(200).render('places', {places: places, title: "Places"});
    });
  });
});

router.get('/place', (req, res, next) => {
  trailapi.getPlaces({lat: req.query.lat, lon: req.query.lon, radius: .01}).then((place) => {
      res.status(200).render('place', {place: place.places, title: req.query.name});
    });
});

router.get('/test', (req, res, next) => {
    res.status(200).render('feed', {title: 'test'});
});

module.exports = router;