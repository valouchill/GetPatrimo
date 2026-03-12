// Controller pour le scraping d'annonces immobilières
const Property = require('../../models/Property');
const { logEvent } = require('../services/eventService');

/**
 * Scrape les informations d'une annonce depuis un lien
 * Pour l'instant, c'est un mock structuré qui peut être remplacé par un vrai scraper
 */
async function scrapeProperty(req, res) {
  try {
    const { url } = req.body || {};
    
    if (!url) {
      return res.status(400).json({ msg: 'URL requise' });
    }

    // Détecte le type d'annonce
    const source = detectSource(url);
    
    // Mock scraping (à remplacer par vraie logique)
    const scrapedData = await mockScrape(url, source);
    
    return res.json({
      success: true,
      source,
      data: scrapedData
    });
  } catch (error) {
    console.error('Erreur scrapeProperty:', error);
    return res.status(500).json({ msg: 'Erreur lors du scraping' });
  }
}

/**
 * Détecte la source de l'annonce depuis l'URL
 */
function detectSource(url) {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('leboncoin.fr') || lowerUrl.includes('leboncoin.com')) {
    return 'leboncoin';
  }
  if (lowerUrl.includes('seloger.com')) {
    return 'seloger';
  }
  if (lowerUrl.includes('airbnb.fr') || lowerUrl.includes('airbnb.com')) {
    return 'airbnb';
  }
  if (lowerUrl.includes('pap.fr')) {
    return 'pap';
  }
  if (lowerUrl.includes('logic-immo.com')) {
    return 'logicimmo';
  }
  
  return 'unknown';
}

/**
 * Mock scraping - à remplacer par vraie logique
 * TODO: Implémenter le vrai scraping avec Puppeteer ou Cheerio
 */
async function mockScrape(url, source) {
  // Simulation d'un délai de scraping
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Extraction basique depuis l'URL (exemple)
  const urlParts = url.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  
  // Mock data selon la source
  const mockData = {
    leboncoin: {
      title: 'Appartement 2 pièces - Paris 11ème',
      address: '15 Rue de la République, 75011 Paris',
      surface: 45,
      rent: 1200,
      charges: 150,
      description: 'Bel appartement lumineux, proche métro',
      photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800']
    },
    seloger: {
      title: 'Studio meublé - Paris Centre',
      address: '8 Avenue des Champs-Élysées, 75008 Paris',
      surface: 30,
      rent: 1500,
      charges: 200,
      description: 'Studio moderne et fonctionnel',
      photos: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800']
    },
    airbnb: {
      title: 'Charmant studio - Montmartre',
      address: '12 Rue Lepic, 75018 Paris',
      surface: 35,
      rent: 1100,
      charges: 100,
      description: 'Studio cosy avec vue sur Paris',
      photos: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800']
    },
    pap: {
      title: 'Appartement 3 pièces - Paris 15ème',
      address: '25 Rue de Vaugirard, 75015 Paris',
      surface: 65,
      rent: 1800,
      charges: 180,
      description: 'Appartement familial, calme',
      photos: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800']
    },
    logicimmo: {
      title: 'T2 rénové - Paris 10ème',
      address: '30 Boulevard de Strasbourg, 75010 Paris',
      surface: 40,
      rent: 1300,
      charges: 120,
      description: 'Appartement récemment rénové',
      photos: ['https://images.unsplash.com/photo-1505843513577-22bb7d21e455?w=800']
    }
  };
  
  const baseData = mockData[source] || mockData.leboncoin;
  
  // Parse l'adresse pour extraire les composants
  const addressParts = parseAddress(baseData.address);
  
  return {
    name: baseData.title,
    address: baseData.address,
    addressLine: addressParts.street,
    zipCode: addressParts.zipCode,
    city: addressParts.city,
    surfaceM2: baseData.surface,
    rentAmount: baseData.rent,
    chargesAmount: baseData.charges,
    description: baseData.description,
    photos: baseData.photos,
    sourceUrl: url
  };
}

/**
 * Parse une adresse pour extraire les composants
 */
function parseAddress(address) {
  // Format attendu: "Numéro Rue, Code Postal Ville"
  const match = address.match(/^(.+?),\s*(\d{5})\s+(.+)$/);
  
  if (match) {
    return {
      street: match[1].trim(),
      zipCode: match[2],
      city: match[3].trim()
    };
  }
  
  // Fallback
  return {
    street: address,
    zipCode: '',
    city: ''
  };
}

module.exports = {
  scrapeProperty
};
