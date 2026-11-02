export function persistentCookieOptions(options={},https=true){return {...options,path:'/',maxAge:options.maxAge===0?0:60*60*24*30,sameSite:'lax',secure:https};}
