const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const dotenv = require('dotenv').config();
const multer = require('multer');
const path = require('path');
const app = express();
const port = 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG and JPG are allowed.'));
    }
  }
});

// Add CORS middleware with specific options
app.use(cors({
  origin: ['http://localhost:3000'], // Add your frontend URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON bodies
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to my Node.js application!' });
});

// Get all playspaces
app.get('/playspaces', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('playspaces')
      .select('*');
    
    if (error) throw error;
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new playspace
app.post('/playspaces', upload.single('image'), async (req, res) => {
  try {
    // Validate required fields
    const { name, description, price, location, amenities } = req.body;

    // Individual field validation
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    // if (!location.address) {
    //   return res.status(400).json({ error: 'Location address is required' });
    // }
    
    // if (!location.coordinates) {
    //   return res.status(400).json({ error: 'Location coordinates are required' });
    // }

    let imageUrl = null;

    // Handle image upload if file is present
    if (req.file) {
      const file = req.file;
      const timestamp = Date.now();
      const fileExtension = path.extname(file.originalname);
      const fileName = `playspace-${timestamp}${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('playspace-images') // Make sure this bucket exists in your Supabase storage
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL for the uploaded image
      const { data: { publicUrl } } = supabase
        .storage
        .from('playspace-images')
        .getPublicUrl(fileName);

      imageUrl = publicUrl;
    }

    // Parse location from string to object if needed
    const locationData = typeof location === 'string' ? JSON.parse(location) : location;

    // Prepare the data for insertion
    const playspaceData = {
      name,
      description,
      price: price || 0,
      image: imageUrl,
      location: {
        address: locationData.address,
        coordinates: {
          lat: locationData.coordinates.lat || 0,
          lng: locationData.coordinates.lng || 0
        }
      },
      amenities: Array.isArray(amenities) ? amenities : 
                (amenities ? JSON.parse(amenities) : [])
    };

    const { data, error } = await supabase
      .from('playspaces')
      .insert([playspaceData])
      .select();
    
    if (error) throw error;
    
    res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error creating playspace:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
}); 