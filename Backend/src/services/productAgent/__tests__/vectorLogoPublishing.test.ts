import { prisma } from '../../../lib/prisma';
import { getProductAgentSettings } from '../settings';
import { publishDraft } from '../publish';
import { parseTemplateOrThrow } from '../../designs/designService';
import { uploadProductFile } from '../../marketplace/productFileDelivery';

jest.mock('../../../lib/prisma', () => ({prisma:{
  productAgentSettings:{findFirst:jest.fn()},
  digitalProduct:{create:jest.fn(),findUnique:jest.fn()},
  productTemplate:{upsert:jest.fn()},
}}));
jest.mock('../../integrations/imageStorage', () => ({uploadImage:jest.fn(async () => 'https://cdn.example.test/preview.jpg')}));
jest.mock('../../marketplace/productImageProtection', () => ({protectProductPreviewImage:jest.fn(async (buffer:Buffer) => ({buffer,mimetype:'image/jpeg'}))}));
jest.mock('../../marketplace/productFileDelivery', () => ({uploadProductFile:jest.fn(async () => 'cdcblob://product-file-private.svg')}));

it('adds logos with zero daily generations while preserving existing settings', async () => {
  jest.mocked(prisma.productAgentSettings.findFirst).mockResolvedValue({enabled:true,dailyCounts:{PRINTS:2,PLANNERS:1},imageQuality:'high',monthlyBudgetUsd:300,runHourUtc:5} as never);
  const settings = await getProductAgentSettings();
  expect(settings.dailyCounts.VECTOR_LOGOS).toBe(0);
  expect(settings.dailyCounts.PRINTS).toBe(2);
  expect(settings.enabled).toBe(true);
});

it('publishes a logo as pending, attaches its editable template and uploads SVG privately', async () => {
  jest.mocked(prisma.digitalProduct.create).mockResolvedValue({id:'logo-product'} as never);
  jest.mocked(prisma.digitalProduct.findUnique).mockResolvedValue({id:'logo-product'} as never);
  const template = parseTemplateOrThrow({format:'cdc-template/1',page:{widthMm:120,heightMm:92,background:'#ffffff'},pages:[{id:'ka-color',elements:[]}]});
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="10" cy="10" rx="5" ry="5"/></svg>');
  expect(await publishDraft({category:'VECTOR_LOGOS',titleKa:'ლოგოს შაბლონი',titleEn:'Logo template',descriptionKa:'შაბლონი',descriptionEn:'Template',priceGel:15,license:'COMMERCIAL_USE',cover:Buffer.from('preview'),gallery:[],files:[{buffer:svg,name:'logo.svg',mimetype:'image/svg+xml'}],editorTemplate:template})).toBe('logo-product');
  expect(uploadProductFile).toHaveBeenCalledWith(svg,'image/svg+xml','logo.svg');
  expect(prisma.digitalProduct.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'PENDING',createdByAgent:true,category:'Design & Graphics / Vector Logos',price:1500,fileUrl:'cdcblob://product-file-private.svg'})}));
  expect(prisma.productTemplate.upsert).toHaveBeenCalledWith(expect.objectContaining({create:expect.objectContaining({productId:'logo-product',data:template})}));
});
