try {
 const dark=localStorage.getItem('exegetical-display-dark')??localStorage.getItem('exegetical-dark');
 document.body.classList.toggle('dark',dark==='true');
} catch {
 // The shared stylesheet supplies the default theme when storage is blocked.
}
