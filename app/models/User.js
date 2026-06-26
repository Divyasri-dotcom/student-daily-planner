import mongoose from 'mongoose';
const UserSchema=new mongoose.Schema({name:{type:String,required:true,trim:true},username:{type:String,required:true,unique:true,lowercase:true,trim:true},password:{type:String,required:true}},{timestamps:true});
export default mongoose.models.User||mongoose.model('User',UserSchema);
