// routes/locationRoutes.js
import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  try {
    const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        latlng: `${lat},${lng}`,
        key: apiKey,
      }
    });

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

router.get('/reverse-geocode', async (req, res) => {
  const { lat, lng } = req.query;
  console.log("Received Lat/Lng:", lat, lng);

  try {
    const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        latlng: `${lat},${lng}`,
        key: process.env.GOOGLE_MAPS_API_KEY,
      }
    });

    console.log("Google API Response:", response.data); // Log this

    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});


export default router;
