export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 // Only deliberately public client credentials may leave this endpoint.
 return res.status(200).json({supabaseUrl:url||null,supabaseKey:key||null,esvEnabled:Boolean(process.env.ESV_API_KEY)});
}
