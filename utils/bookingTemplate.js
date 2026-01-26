const Handlebars = require('handlebars');
const Template = require('../models/Template');
const puppeteer = require("puppeteer");
const logger = require('../utils/logger');
const fs = require('fs').promises;
const Operator = require("../models/Operator");
const path = require("path");

// Register date formatting helper
Handlebars.registerHelper('formatDate', function (date) {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
});


//  Default fallback helper
Handlebars.registerHelper('default', function (value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  return value;
});

module.exports = async function generatePdfBuffer(booking) {
  logger.info('Generating PDF for booking', booking );

    const operator = await Operator.findById(booking.operatorId).select('bookingTemplate').lean();
    let templateName = operator?.bookingTemplate;
    if (!templateName) {
      templateName = 'booking-confirmation-template.html';
    }
    // 1. Get the template path using the operator's ID
    const templatePath = path.join(__dirname, '..', 'templates', templateName);

    // 2. Read the template file
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const compiledTemplate = Handlebars.compile(templateContent);
    const html = compiledTemplate(booking);
  const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Added for better compatibility
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
  });

  await browser.close();
  return pdfBuffer;
};
