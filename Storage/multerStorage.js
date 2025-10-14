import multer from "multer"
import path from "path"

const storage = multer.diskStorage({
    destination:function(req,file,cb){
        cb(null,"uploads/");
    },
    filename:function (req,file,cb){
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname+ "-" + Date.now()+ext);
    },
})

const fileFilter = (req,file,cb)=>{
    if(file.mimetype.startsWith("image/")){
        cb(null,true);
    }else{
        cb(new Error("Only image file are allowed"), false)
    }
}

export const upload = multer({storage, fileFilter});