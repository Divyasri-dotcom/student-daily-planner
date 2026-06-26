import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
const COOKIE='standup_token';
const LOCAL_SECRET='standup-wall-local-dev-secret-change-before-deploy';
function jwtSecret(){return process.env.JWT_SECRET||LOCAL_SECRET;}
export function signToken(user){const id=String(user.id||user._id);return jwt.sign({id,username:user.username,name:user.name},jwtSecret(),{expiresIn:'7d'});}
export async function setAuthCookie(token){(await cookies()).set(COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:60*60*24*7});}
export async function clearAuthCookie(){(await cookies()).delete(COOKIE);}
export async function getUserFromCookie(){const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;try{return jwt.verify(token,jwtSecret())}catch{return null}}
