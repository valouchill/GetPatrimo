import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Import dynamique pour éviter les erreurs au build
    const OpenAI = (await import('openai')).default;
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { images, propertyInfo } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'Aucune image fournie' },
        { status: 400 }
      );
    }

    // Limiter à 5 images pour contrôler les coûts
    const imagesToAnalyze = images.slice(0, 5);

    // Prompt Haute Couture pour copywriting immobilier de prestige
    const systemPrompt = `Tu es un expert en copywriting immobilier de prestige. Tu sais analyser les photos avec un œil d'architecte d'intérieur : tu identifies les matériaux (parquet Point de Hongrie, marbre de Carrare, chêne massif, béton ciré), la hauteur sous plafond, la luminosité, la qualité des vues, le style architectural.

OBJECTIF: Créer 3 versions d'annonce qui FILTRENT les locataires par le verbe, en s'adaptant à l'audience cible.

Tu dois retourner un JSON valide avec EXACTEMENT cette structure:
{
  "features": [
    {"name": "caractéristique précise avec matériau", "emoji": "🏠", "confidence": 0.9, "selling_point": true}
  ],
  "quality_score": 8,
  "estimated_rent_modifier": 0,
  "property_type": "appartement",
  "condition": "excellent",
  "luminosity": "description précise (ex: lumière zénithale traversante, orientation sud-ouest)",
  "style": "moderne / haussmannien / art déco / contemporain / industriel",
  "atmosphere": "description sensorielle précise",
  "materials_detected": ["Parquet Point de Hongrie", "Marbre Carrare", "Moulures XIXe"],
  "ceiling_height": "estimation en mètres si visible (ex: 3m20)",
  "view_quality": "description de la vue si visible",
  "target_audience": "audience suggérée",
  "highlights": ["Point fort précis avec mesure ou matériau", "Point fort 2", "Point fort 3"],
  "unique_selling_points": ["Ce qui distingue vraiment ce bien"],
  "improvements": ["Conseil staging optionnel"],
  "description_suggestion": "Accroche de prestige, 120 car. max",
  "headline_options": [
    "🏠 Titre LeBonCoin factuel (max 70 car.)",
    "✨ Variante prestige",
    "📍 Variante quartier"
  ],
  "ad_bullets": [
    "✓ Atout majeur avec détail matériau/mesure",
    "✓ Deuxième atout spécifique",
    "✓ Troisième atout (confort ou équipement précis)",
    "✓ Quatrième atout (luminosité/vue/calme)",
    "✓ Cinquième atout (localisation/transports)"
  ],
  "ad_paragraph": "Paragraphe de prestige, 3-4 phrases. Mentionne les matériaux visibles, les volumes, la lumière.",
  "ad_full_standard": "Ton 'Discret & Prestigieux' (180-220 mots). Vocabulaire d'architecture d'intérieur. Ne dis jamais 'Bel appartement'. Décris les volumes sous Xm de plafond, les matériaux nobles visibles, la rénovation si récente. Termine par : 'Pour préserver la confidentialité des parties, ce bien est géré sous protocole PatrimoTrust.'",
  "ad_full_storytelling": "Ton 'Technique & Exhaustif' (180-220 mots). DPE, loi Carrez, charges détaillées, proximité transports/commerces, étage, ascenseur, exposition. Factuel et rassurant pour un locataire méthodique.",
  "ad_full_premium": "Ton 'Rapide & Direct' (80-120 mots). L'essentiel en phrases courtes. Type, surface, pièces, étage, DPE, loyer. Pour ceux qui n'ont pas le temps de lire.",
  "keywords": ["mot-clé SEO 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5", "mot-clé 6"],
  "hashtags": ["#immobilier", "#location", "#appartement"],
  "call_to_action": "Phrase d'incitation élégante"
}

RÈGLES D'ANALYSE VISUELLE (CRITIQUE):

1. FEATURES (8-15 caractéristiques PRÉCISES):
   - Identifie les MATÉRIAUX visibles : type de parquet (point de Hongrie, chevron, lames larges), pierre (marbre, travertin), bois (chêne, noyer)
   - Hauteur sous plafond : estime en mètres (2m50, 3m, 3m20)
   - Moulures, corniches, rosaces si présentes
   - Cuisine : plan de travail (granit, quartz, bois), équipements visibles
   - Salle de bain : faïence, robinetterie, douche italienne, baignoire
   - Menuiseries : type de fenêtres (double vitrage, baies, velux)
   - Luminosité PRÉCISE : traversante, zénithale, orientation si déductible
   - Vue : urbaine dégagée, sur parc, sur monument, sur cour arborée

2. HEADLINES (titres LeBonCoin):
   - Max 70 caractères
   - Inclus un fait concret ("Parquet massif", "3m sous plafond", "Terrasse 12m²")
   - Jamais de superlatifs vides

3. AD_BULLETS: Chaque bullet contient un FAIT vérifiable

4. ANNONCES COMPLÈTES - 3 TONS DISTINCTS:
   - ad_full_standard = "Discret & Prestigieux" : Architecture, matériaux, atmosphère. Filtre par le vocabulaire.
   - ad_full_storytelling = "Technique & Exhaustif" : Données factuelles, DPE, charges, m², étage, transports
   - ad_full_premium = "Rapide & Direct" : Essentiel en 5-6 phrases max, direct au but

5. HONNÊTETÉ VISUELLE:
   - Ne décris QUE ce qui est visible
   - Nomme les matériaux par leur nom exact si identifiables
   - Si incertain : "semble être du parquet point de Hongrie", "hauteur sous plafond estimée à 2m80"

6. MOTS QUI CONVERTISSENT:
   - Utilise: lumineux, calme, fonctionnel, pratique, rénové, soigné, bien agencé
   - Évite: petit, étroit, basique, standard, quelconque
   - Power words: coup de cœur, rare, idéal, parfait état, prêt à vivre

Retourne UNIQUEMENT le JSON, sans markdown ni texte avant/après.`;

    // Construire les messages avec les images en haute résolution
    const imageContents: any[] = imagesToAnalyze.map((img: string) => ({
      type: 'image_url',
      image_url: {
        url: img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`,
        detail: 'high',
      },
    }));

    const audienceMap: Record<string, string> = {
      'general': 'Tout public',
      'famille': 'Famille avec enfants - école, sécurité, espace',
      'cadre': 'Jeune cadre - transports, connectivité, standing',
      'expatrie': 'Expatrié - quartier international, services en anglais, standing',
      'etudiant': 'Étudiant - budget, transports, vie de quartier'
    };
    const targetAudience = propertyInfo?.audience ? audienceMap[propertyInfo.audience] || 'Tout public' : 'Tout public';

    const userMessage = propertyInfo 
      ? `Analyse ces ${imagesToAnalyze.length} photo(s) d'un bien immobilier. IDENTIFIE les matériaux, la hauteur sous plafond, la qualité de lumière, les vues.

INFORMATIONS DU BIEN:
- Adresse: ${propertyInfo.address || 'Non renseignée'}
- Surface: ${propertyInfo.surface || 'Non renseignée'}m²
- Nombre de pièces: ${propertyInfo.rooms || 'Non renseigné'}
- Type: ${propertyInfo.type || 'appartement'}
- Loyer: ${propertyInfo.rent || 'Non renseigné'}€${propertyInfo.charges ? ' + ' + propertyInfo.charges + '€ de charges' : ''}
- Meublé: ${propertyInfo.furnished ? 'Oui' : 'Non'}
- Étage: ${propertyInfo.floor || 'Non renseigné'}
- Ascenseur: ${propertyInfo.elevator ? 'Oui' : 'Non'}
- DPE: ${propertyInfo.dpe || 'Non renseigné'}
- Parking: ${propertyInfo.parking ? 'Oui' : 'Non'}

AUDIENCE CIBLE: ${targetAudience}
Adapte le vocabulaire et les arguments selon cette audience.

${propertyInfo.oneLiner ? `NOTE DU PROPRIÉTAIRE: "${propertyInfo.oneLiner}"` : ''}

IMPORTANT: Identifie PRÉCISÉMENT les matériaux visibles (type de parquet, pierre, marbre, etc.), estime la hauteur sous plafond, décris la luminosité et la vue. Ne sois JAMAIS générique.
Retourne uniquement le JSON, sans markdown ni explication.`
      : `Analyse ces ${imagesToAnalyze.length} photo(s) d'un bien immobilier. Identifie les matériaux, les volumes, la lumière.
Retourne uniquement le JSON, sans markdown ni explication.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            ...imageContents,
          ],
        },
      ],
      max_tokens: 3000,
      temperature: 0.6,
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parser le JSON de la réponse
    let analysis;
    try {
      // Nettoyer la réponse (enlever les backticks markdown si présents)
      const cleanedContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      analysis = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Erreur parsing JSON:', content);
      // Retourner une analyse par défaut en cas d'erreur
      analysis = {
        features: [{ name: 'Bien immobilier', emoji: '🏠', confidence: 0.8, selling_point: true }],
        quality_score: 6,
        estimated_rent_modifier: 0,
        property_type: 'appartement',
        condition: 'bon',
        luminosity: 'correct',
        style: 'classique',
        atmosphere: 'agréable',
        target_audience: 'tout public',
        highlights: ['Bien à découvrir', 'Bon potentiel', 'Emplacement pratique'],
        unique_selling_points: ['À visiter pour se faire une idée'],
        improvements: ['Ajoutez plus de photos pour une meilleure analyse'],
        description_suggestion: 'Bel appartement à découvrir',
        headline_options: [
          '🏠 Bel appartement à découvrir - Disponible immédiatement',
          '✨ Appartement lumineux et bien situé',
          '📍 Logement pratique - Idéal pour s\'installer'
        ],
        ad_bullets: [
          '✓ Disponible rapidement',
          '✓ Bon état général',
          '✓ À visiter pour apprécier',
          '✓ Emplacement pratique',
          '✓ Idéal première location'
        ],
        ad_paragraph: 'Découvrez ce bel appartement disponible à la location. Un logement fonctionnel dans un cadre agréable. Contactez-nous pour organiser une visite.',
        ad_full_standard: 'Bel appartement disponible à la location. Ce logement offre un cadre de vie agréable et fonctionnel. Idéalement situé, il conviendra parfaitement aux personnes recherchant un lieu de vie pratique. N\'hésitez pas à nous contacter pour plus d\'informations ou pour organiser une visite.',
        ad_full_storytelling: 'Imaginez-vous dans ce nouvel espace qui n\'attend que vous. Un lieu où poser vos valises et créer de nouveaux souvenirs. Ce logement vous offre le confort dont vous avez besoin au quotidien. Venez le découvrir et laissez-vous séduire.',
        ad_full_premium: 'Nous avons le plaisir de vous présenter ce bien immobilier sélectionné avec soin. Un logement qui saura répondre à vos attentes en termes de confort et de praticité. Une opportunité à saisir pour les personnes exigeantes.',
        keywords: ['appartement', 'location', 'disponible', 'lumineux', 'pratique', 'confort'],
        hashtags: ['#immobilier', '#location', '#appartement'],
        call_to_action: 'Contactez-nous vite pour organiser votre visite !',
        raw_response: content,
      };
    }

    return NextResponse.json({
      success: true,
      analysis,
      images_analyzed: imagesToAnalyze.length,
      model: 'gpt-4o',
    });

  } catch (error: any) {
    console.error('Erreur analyse photos:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'analyse des photos',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
