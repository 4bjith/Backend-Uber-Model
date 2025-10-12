import jwt from "jsonwebtoken"
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET

export const LoginCheck = (req,res,next)=>{
    try{
    const authHeader = req.headers["authorization"];
    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({message:"Authorization token missing of malformed"})
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token,JWT_SECRET)
    req.user = decoded;
    next()
    }catch(err){
        return res.status(403).json({message:"Invalid or expired token"});
    }
}