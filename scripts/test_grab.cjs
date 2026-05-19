const p=require('puppeteer');
(async()=>{
  const b=await p.launch({userDataDir:'./.chrome-profile',headless:true});
  const pg=await b.newPage();
  await pg.goto('http://cck.uparts.info/car2009/Default/', {waitUntil:'domcontentloaded'});
  await new Promise(r=>setTimeout(r,1000));
  await pg.evaluate(()=>{
    const i=document.querySelector('input[type="text"]');
    if(i){
      i.value='COM-T001T';
      i.dispatchEvent(new Event('change',{bubbles:true}));
    }
    document.querySelector('#btn_search')?.click();
  });
  await new Promise(r=>setTimeout(r,3000));
  const res=await pg.evaluate(()=>{
    return Array.from(document.querySelectorAll('tr')).map(tr => {
      return {
        rowAttr: tr.getAttribute('row'),
        html: tr.innerHTML.substring(0, 200)
      };
    }).filter(x => x.html.includes('COM-T001T'));
  });
  console.log(JSON.stringify(res, null, 2));
  await b.close();
})();
