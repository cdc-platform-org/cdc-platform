import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { RunCost, writeJson } from '../ai';
import { AGENT_CATEGORIES } from '../categories';
import { buildLogoTemplate, generateVectorLogos, logoBriefSchema, LogoBrief } from '../generators/vectorLogos';
import { isVectorPage, renderVectorSvg } from '../../designs/vectorSvg';
import { designTemplateSchema } from '../../../schemas/designTemplateSchemas';

jest.mock('../ai', () => ({...jest.requireActual('../ai'), writeJson:jest.fn(), generateArtwork:jest.fn(() => {throw new Error('Logos must not call image generation');})}));

const brief: LogoBrief = {
  nameKa:'ორბიტა — სტუდიის ლოგო',nameEn:'Orbita Studio Logo',
  introKa:'მინიმალისტური ლოგოს რედაქტირებადი შაბლონი ციფრული სტუდიისა და შემოქმედებითი ბიზნესისთვის.',
  introEn:'A customizable geometric identity template for a fictional digital studio and creative business.',
  primary:'#325c53',secondary:'#aa6038',
  ka:{brand:'ორბიტა',tagline:'ციფრული სტუდია'},en:{brand:'ORBITA',tagline:'DIGITAL STUDIO'},
  shapes:[
    {shape:'ellipse',x:20,y:20,w:42,h:60,rotation:-32,radius:0,fill:'none',stroke:'primary',strokeWidth:5},
    {shape:'ellipse',x:38,y:20,w:42,h:60,rotation:32,radius:0,fill:'none',stroke:'secondary',strokeWidth:5},
    {shape:'ellipse',x:43,y:43,w:14,h:14,rotation:0,radius:0,fill:'primary',stroke:'none',strokeWidth:0},
  ],
};

beforeEach(() => jest.clearAllMocks());

it('builds six independently editable KA/EN variants using the existing editor schema', () => {
  expect(logoBriefSchema.safeParse(brief).success).toBe(true);
  const template = buildLogoTemplate(brief);
  expect(designTemplateSchema.safeParse(template).success).toBe(true);
  expect(template.pages.map(p => p.id)).toEqual(['ka-color','ka-mono','ka-inverse','en-color','en-mono','en-inverse']);
  expect(template.pages.every(p => p.elements.every(e => e.editable && !e.locked && e.type !== 'image'))).toBe(true);
  expect(template.pages[0].elements.find(e => e.type === 'text' && e.id === 'brand-name')).toMatchObject({text:'ორბიტა'});
  expect(template.pages[3].elements.find(e => e.type === 'text' && e.id === 'brand-name')).toMatchObject({text:'ORBITA'});
  expect(template.pages[1].elements.filter(e => e.type === 'shape').every(e => e.type === 'shape' && e.stroke !== '#325c53')).toBe(true);
});

it('refuses invisible, unbounded and markup-supplied symbols before creating files', () => {
  for (const patch of [{w:200}, {rotation:45,x:70,w:30}, {fill:'none',stroke:'none'}, {shape:'<script>'}]) {
    expect(logoBriefSchema.safeParse({...brief,shapes:[{...brief.shapes[0],...patch},brief.shapes[1]]}).success).toBe(false);
  }
});

it('fits long sample names into one editable line without overlapping the tagline', () => {
  const template = buildLogoTemplate({...brief,ka:{brand:'W'.repeat(24),tagline:'W'.repeat(48)}});
  const brand = template.pages[0].elements.find(e => e.id === 'brand-name');
  expect(brand?.type === 'text' && brand.fontSizePt).toBeLessThan(26);
  expect(designTemplateSchema.safeParse(template).success).toBe(true);
});

it('exports editable vector geometry, embedded fonts, rotation and safely escaped text', () => {
  const template = buildLogoTemplate(brief);
  const text = template.pages[0].elements.find(e => e.type === 'text')!;
  if (text.type === 'text') text.text = '<script>alert("x")</script> & სტუდია';
  const svg = renderVectorSvg(template,0,true);
  expect(svg).toContain('<ellipse');
  expect(svg).toContain('rotate(-32');
  expect(svg).toContain('<text');
  expect(svg).toContain('data:font/woff;base64,');
  expect(svg).toContain('&lt;script&gt;');
  expect(svg).not.toMatch(/<script|<image|<foreignObject|data:image|data-page-background/);
  expect(renderVectorSvg(template,0,false)).toContain('data-page-background');
  const withImage = structuredClone(template);
  withImage.pages[0].elements.push({id:'raster',type:'image',xMm:0,yMm:0,wMm:10,hMm:10,rotation:0,opacity:1,editable:true,locked:false,src:'https://example.com/image.png',fit:'cover',clip:'rect',placeholder:false});
  expect(isVectorPage(withImage,0)).toBe(false);
  expect(() => renderVectorSvg(withImage)).toThrow(/only text and vector/);
  expect(() => renderVectorSvg(template,29)).toThrow();
});

it('renders all outputs without paid image calls and keeps transparent PNGs and SVGs private-ready', async () => {
  jest.mocked(writeJson).mockResolvedValue(brief);
  const cost = new RunCost();
  const draft = await generateVectorLogos({cost,category:'VECTOR_LOGOS',priceGel:15,quality:'high',theme:{theme:'original studio logo',bestSellers:[],recentTitles:[],lessons:[]}});
  expect(draft.files).toHaveLength(14);
  expect(draft.files.filter(f => f.mimetype === 'image/svg+xml')).toHaveLength(6);
  expect(draft.files.filter(f => f.mimetype === 'image/png')).toHaveLength(6);
  expect(draft.editorTemplate?.pages).toHaveLength(6);
  expect(cost.images).toBe(0);
  expect(draft.descriptionEn).toContain('Non-exclusive');
  const png = draft.files.find(f => f.mimetype === 'image/png')!.buffer;
  const {data,info} = await sharp(png).raw().toBuffer({resolveWithObject:true});
  expect(info.width).toBe(1800);
  expect(info.channels).toBe(4);
  expect(data[3]).toBe(0);
  expect((await sharp(png).stats()).channels[3].max).toBe(255);
  expect((await sharp(draft.cover).stats()).isOpaque).toBe(true);
  const output = path.resolve('test-results/vector-logos');
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'sample-template.json'),JSON.stringify(draft.editorTemplate,null,2));
  fs.writeFileSync(path.join(output,'sample.svg'),draft.files[0].buffer);
  fs.writeFileSync(path.join(output,'sample-preview.png'),draft.cover);
  fs.writeFileSync(path.join(output,'sample-transparent.png'),png);
  expect(AGENT_CATEGORIES.VECTOR_LOGOS.storeCategory).toBe(draft.category === 'VECTOR_LOGOS' ? 'Design & Graphics / Vector Logos' : '');
},30000);
