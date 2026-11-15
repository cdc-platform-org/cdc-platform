import {test,expect,type Page} from '@playwright/test';
import fs from 'fs';

const user = {id:'logo-buyer',name:'Logo Buyer',email:'logo@example.test',role:'Student',adminRole:'SUPER_ADMIN',status:'APPROVED',verificationStatus:'APPROVED',termsAcceptedAt:'2026-01-01T00:00:00Z',isBanned:false};
const template = {
  format:'cdc-template/1',title:'Studio logo',locale:'ka',page:{widthMm:120,heightMm:92,background:'#ffffff'},fonts:['FiraGO'],
  pages:['ka','en'].map(lang => ({id:`${lang}-color`,elements:[
    {id:'symbol',type:'shape',shape:'ellipse',xMm:46,yMm:14,wMm:28,hMm:28,fill:'#325c53',stroke:null,strokeWidthMm:0,radiusMm:0,editable:true,locked:false},
    {id:'brand-name',type:'text',xMm:10,yMm:54,wMm:100,hMm:14,text:lang === 'ka' ? 'ორბიტა' : 'ORBITA',fontFamily:'FiraGO',fontSizePt:26,fontWeight:700,color:'#1b1e21',align:'center',lineHeight:1.3,letterSpacing:0,editable:true,locked:false},
  ]})),
};

test.beforeEach(async ({page}) => {
  await page.addInitScript(user => {
    localStorage.setItem('cdc_access_token','test-logo-session');
    localStorage.setItem('cdc_user',JSON.stringify(user));
    localStorage.setItem('cdc_terms_accepted',user.id);
    localStorage.setItem('cdc-cookie-consent',JSON.stringify({essential:true,analytics:false,marketing:false,decidedAt:new Date().toISOString()}));
  },user);
  await page.route('**/api/**',async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) return route.fulfill({json:{user}});
    if (pathname.endsWith('/designs/test-logo')) return route.fulfill({json:{data:{id:'test-logo',title:'Studio logo',productId:'logo-product',templateVersion:1,updatedAt:new Date().toISOString(),data:template}}});
    return route.fulfill({json:{data:[]}});
  });
});

async function assertTransparentPng(page:Page,filename:string) {
  const data = fs.readFileSync(filename).toString('base64');
  const alpha = await page.evaluate(async data => {
    const image = new Image(); image.src=`data:image/png;base64,${data}`; await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
    return ctx.getImageData(0,0,1,1).data[3];
  },data);
  expect(alpha).toBe(0);
}

for (const locale of ['ka','en']) {
  test(`${locale} logo text edits export the current page as SVG and transparent PNG`,async ({page},info) => {
    let payload: {data:typeof template;pageIndex:number;transparent:boolean} | undefined;
    await page.route('**/api/designs/test-logo/export-svg',async route => {
      payload=route.request().postDataJSON();
      await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"><text>Edited logo</text></svg>'});
    });
    await page.goto(`${locale === 'en' ? '/en' : ''}/dashboard/designs/test-logo`);
    const svgButton = page.getByRole('button',{name:'SVG',exact:true});
    await expect(svgButton).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const canvas = page.locator('canvas.upper-canvas');
    const bounds = await canvas.boundingBox();
    await canvas.click({position:{x:bounds!.width/2,y:bounds!.height*0.65}});
    const text=page.locator('textarea');
    await expect(text).toBeVisible();
    await text.fill(locale === 'ka' ? 'ახალი ბრენდი' : 'NEW BRAND');
    await page.locator('input:not([type="color"])').and(page.getByRole('textbox',{name:locale === 'ka' ? 'ფერი' : 'Color',exact:true})).fill('#214e34');
    await page.getByRole('checkbox',{name:locale === 'ka' ? 'გამჭვირვალე ფონი' : 'Transparent background'}).check();
    const svgDownloadPromise=page.waitForEvent('download');
    await svgButton.click();
    const svgDownload=await svgDownloadPromise;
    expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
    expect(payload?.transparent).toBe(true);
    expect(payload?.pageIndex).toBe(0);
    expect(payload?.data.pages[0].elements.find(e => e.type === 'text')).toMatchObject({text:locale === 'ka' ? 'ახალი ბრენდი' : 'NEW BRAND',color:'#214e34'});
    const pngDownloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'PNG',exact:true}).click();
    const pngDownload=await pngDownloadPromise;
    await assertTransparentPng(page,(await pngDownload.path())!);
    await page.getByRole('button',{name:locale === 'ka' ? 'გვერდი 2' : 'Page 2',exact:true}).click();
    const secondDownload=page.waitForEvent('download');await svgButton.click();await secondDownload;
    expect(payload?.pageIndex).toBe(1);
    expect(payload?.data.pages[1].elements.find(e => e.type === 'text')).toMatchObject({text:'ORBITA'});
    await page.screenshot({path:info.outputPath(`logo-editor-${locale}.png`),fullPage:true});
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`${locale} admin can configure and request the new vector category`,async ({page}) => {
    let dailyCounts:Record<string,number> = {}, requested:string[]=[];
    const overview={settings:{enabled:false,dailyCounts:{VECTOR_LOGOS:0},imageQuality:'high',monthlyBudgetUsd:300,runHourUtc:5},spend:{todayUsd:0,monthUsd:0,monthProducts:0},busy:false,configured:true,categories:[{key:'VECTOR_LOGOS',labelKa:'ვექტორული ლოგოების შაბლონები',labelEn:'Editable vector logo templates',storeCategory:'Design & Graphics / Vector Logos',defaultPriceGel:15,estimatedCostUsd:0.05,needsFactCheck:false}],runs:[],products:[],trendBriefs:[]};
    await page.route('**/api/admin/product-agent**',async route => {
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith('/settings')) {dailyCounts=route.request().postDataJSON().dailyCounts;return route.fulfill({json:{data:{...overview.settings,dailyCounts}}});}
      if(path.endsWith('/run')) {requested=route.request().postDataJSON().categories;return route.fulfill({status:202,json:{data:{runIds:['logo-run']}}});}
      return route.fulfill({json:{data:overview}});
    });
    await page.goto(`${locale === 'en' ? '/en' : ''}/admin/product-agent`);
    if ((page.viewportSize()?.width ?? 1440) < 1024) {
      const menu=page.getByRole('button',{name:'Menu',exact:true});
      await menu.click();await expect(menu).toHaveAttribute('aria-expanded','true');
      await menu.click();await expect(menu).toHaveAttribute('aria-expanded','false');
    }
    const row=page.getByRole('row').filter({hasText:locale === 'en' ? 'Editable vector logo templates' : 'ვექტორული ლოგოების შაბლონები'});
    await expect(row).toContainText('SVG +');
    await expect(row.getByRole('spinbutton')).toHaveValue('0');
    await row.getByRole('spinbutton').fill('2');
    await page.getByRole('button',{name:'შენახვა',exact:true}).click();
    await expect.poll(() => dailyCounts.VECTOR_LOGOS).toBe(2);
    await row.getByRole('button',{name:'შექმენი 1 ახლა',exact:true}).click();
    await expect.poll(() => requested).toEqual(['VECTOR_LOGOS']);
  });

  test(`${locale} vector logos appear under the existing Logos & design market filter`,async ({page}) => {
    await page.route('**/api/products',route => route.fulfill({json:{data:[{id:'logo-market-item',title:'ორბიტას ლოგო',titleEn:'Orbita Logo',description:'ლოგოს რედაქტირებადი შაბლონი',descriptionEn:'Editable vector logo template',category:'Design & Graphics / Vector Logos',price:1500,imageUrl:'/images/cdc-logo.png',previewImages:[],status:'APPROVED',licenseType:'COMMERCIAL_USE',createdAt:'2026-11-15T00:00:00Z',salesCount:0,hasEditableTemplate:true}]}}));
    const category=locale === 'ka' ? 'ლოგოები, ბანერები და საბეჭდი მასალები' : 'Logos, Banners & Print Assets';
    await page.goto(`${locale === 'en' ? '/en' : ''}/marketplace?category=${encodeURIComponent(category)}`);
    await expect(page.getByText(locale === 'ka' ? 'ორბიტას ლოგო' : 'Orbita Logo',{exact:true})).toBeVisible();
  });
}
