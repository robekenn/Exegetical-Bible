import nodemailer from 'nodemailer';

export function moderationMailer(env){
 const email=env.MODERATION_SMTP_USER;
 const password=env.MODERATION_SMTP_PASSWORD?.replace(/\s/g,'');
 if(!email||!password)return null;
 const smtp=nodemailer.createTransport({
  host:'smtp.gmail.com',port:465,secure:true,
  auth:{user:email,pass:password},
  connectionTimeout:7000,greetingTimeout:7000,socketTimeout:10000
 });
 return async ({email:recipient,reason,appeal_token})=>{
  const appeal=new URL('/appeal/','https://exegetical-bible.vercel.app');
  appeal.hash=appeal_token;
  await smtp.sendMail({
   from:{name:'Exegetical Bible',address:email},to:recipient,subject:'Your Exegetical Bible account was banned',
   text:[
    'Your Exegetical Bible account was deleted and this email address was blocked from creating a new account.',
    'Reason: '+reason,
    'If you believe this was a mistake, use this private link to submit an appeal:',
    appeal.href,
    'Explain what you believe should be reconsidered. An administrator will review your appeal. If the block is lifted, you can create a new account using this email. Deleted account data cannot be restored.'
   ].join('\n\n')
  });
 };
}
