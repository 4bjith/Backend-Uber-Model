import express from 'express';
// import { LoginCheck } from '../Middlewere/Auth.js';


const ride = express.Router();

ride.post('/bookride',  BookRide);
ride.post('/driver/acceptride',  updateRideStatus);

export default ride;