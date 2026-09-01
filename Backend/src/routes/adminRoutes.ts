import express from 'express';
import prisma from '../prisma'; // Assuming Prisma is used for database access
/**
 * GET /admin/active-items
 * Fetch active products, tools, and courses dynamically.
 */
router.get('/active-items', async (req, res) => {
  try {
    const products = await prisma.product.findMany({ where: { isActive: true } });
    const tools = await prisma.tool.findMany({ where: { isActive: true } });
    const courses = await prisma.course.findMany({ where: { isActive: true } });

    res.json({ products, tools, courses });
  } catch (error) {
    console.error('Error fetching active items:', error);
    res.status(500).json({ message: 'Failed to fetch active items.' });
  }
});
