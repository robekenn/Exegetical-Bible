const photoTypes=/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/;

export function validProfilePhoto(data){
 return typeof data==='string'&&data.length<100000&&photoTypes.test(data);
}

export function resizeProfilePhoto(image,convert){
 const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
 if(!width||!height)throw Error('This photo could not be opened.');
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=256;
 const crop=Math.min(width,height);
 canvas.getContext('2d').drawImage(image,(width-crop)/2,(height-crop)/2,crop,crop,0,0,256,256);
 const webp=canvas.toDataURL('image/webp',.8);
 if(validProfilePhoto(webp))return webp;
 const jpeg=canvas.toDataURL('image/jpeg',.76);
 if(convert&&/^data:image\/jpeg;base64,/.test(jpeg)&&jpeg.length<150000)return convert(jpeg);
 throw Error('This photo could not be resized. Try another photo.');
}

export async function readProfilePhoto(file,convert){
 if(file.size>30*1024*1024)throw Error('Choose a photo smaller than 30 MB.');
 if(!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)&&!(!file.type&&/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)))throw Error('Choose a JPEG, PNG, WebP, HEIC, or HEIF photo.');
 let image;
 try{
  image=await createImageBitmap(file);
 }catch{
  // The reader's Content Security Policy allows data URLs for images.
  try{
   const source=await new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reader.onabort=reject;
    reader.readAsDataURL(file);
   });
   image=new Image();
   image.src=source;
   await image.decode();
  }catch{throw Error('This photo could not be opened on your device. Try a JPEG or PNG.');}
 }
 try{return await resizeProfilePhoto(image,convert);}
 finally{image.close?.();}
}
