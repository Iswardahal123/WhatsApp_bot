// app.js

// आवश्यक लाइब्रेरी आयात करें
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode'); // QR कोड जेनरेट करने के लिए
const express = require('express'); // एक वेब सर्वर बनाने के लिए
const fs = require('fs');

// एक्सप्रेस ऐप और पोर्ट को सेट करें
const app = express();
const port = process.env.PORT || 3000; // Render पोर्ट को ऑटोमेटिकली सेट करता है

// WhatsApp क्लाइंट को इनिशियलाइज़ करें
let qrCodeData = 'QR code is not generated yet. Please wait...';
let isClientReady = false;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ],
    }
});

// मालिक की ऑनलाइन स्थिति को स्टोर करें
let isOwnerOnline = true;
const STATUS_FILE = 'owner_status.json';

function loadOwnerStatus() {
    if (fs.existsSync(STATUS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
            isOwnerOnline = data.isOwnerOnline;
        } catch (error) {
            console.error('मालिक की स्थिति लोड करने में त्रुटि:', error);
        }
    } else {
        saveOwnerStatus();
    }
}

function saveOwnerStatus() {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ isOwnerOnline }), 'utf8');
}

loadOwnerStatus();

// WhatsApp इवेंट लिसनर
client.on('qr', async qr => {
    console.log('QR कोड प्राप्त हुआ। इसे वेब पेज पर प्रदर्शित किया जाएगा।');
    qrCodeData = await qrcode.toDataURL(qr);
});

client.on('ready', () => {
    isClientReady = true;
    console.log('WhatsApp क्लाइंट तैयार है! बॉट अब काम कर रहा है।');
});

client.on('message', async msg => {
    if (msg.fromMe) return;

    const messageBody = msg.body;
    console.log(`[मैसेज प्राप्त] ${msg.from}: "${messageBody}"`);

    if (!isOwnerOnline) {
        let botResponseText = '';
        if (messageBody.toLowerCase().includes('hi') || messageBody.toLowerCase().includes('hello') || messageBody.toLowerCase().includes('नमस्ते')) {
            botResponseText = 'नमस्ते! मैं अभी थोड़ी देर के लिए अनुपलब्ध हूँ। आपका मैसेज महत्वपूर्ण है, मैं जल्द ही आपको जवाब दूंगा।';
        } else if (messageBody.toLowerCase().includes('how are you') || messageBody.toLowerCase().includes('क्या हाल है') || messageBody.toLowerCase().includes('कैसे हो')) {
            botResponseText = 'मैं एक बॉट हूँ और ठीक काम कर रहा हूँ। अभी मेरा मालिक उपलब्ध नहीं है।';
        } else {
            // आपको यहां अपनी Google Gemini API कुंजी डालनी होगी
            const GEMINI_API_KEY = "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"; // <--- यहां अपनी Gemini API कुंजी डालें
            if (!GEMINI_API_KEY) {
                botResponseText = 'मालिक ऑफ़लाइन है और AI कुंजी कॉन्फ़िगर नहीं है। मैं अभी आपके अनुरोध को संसाधित नहीं कर सकता।';
            } else {
                try {
                    const prompt = `मुझे इस उपयोगकर्ता के संदेश का एक संक्षिप्त, सहायक जवाब दें, यह मानते हुए कि मेरा मालिक अभी ऑफ़लाइन है और मैं उसका सहायक बॉट हूँ। संदेश: "${messageBody}"`;
                    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
                    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;
                    
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    
                    if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts) {
                        botResponseText = result.candidates[0].content.parts[0].text;
                    } else {
                        botResponseText = 'क्षमा करें, AI जवाब देने में असमर्थ है।';
                    }
                } catch (error) {
                    console.error('Gemini API कॉल में त्रुटि:', error);
                    botResponseText = 'क्षमा करें, एक तकनीकी त्रुटि हुई है। मेरा मालिक जल्द ही वापस आएगा।';
                }
            }
        }
        await client.sendMessage(msg.from, botResponseText);
        console.log(`[बॉट का जवाब] ${msg.from}: "${botResponseText}"`);
    } else {
        console.log('मालिक ऑनलाइन है, बॉट जवाब नहीं देगा।');
    }
});

client.on('auth_failure', () => {
    console.error('प्रमाणीकरण विफल हुआ!');
    qrCodeData = 'Authentication failed. Please restart the service or clear the session data.';
});

// वेब सर्वर सेटअप
app.get('/', (req, res) => {
    if (isClientReady) {
        res.send(`
            <h1>WhatsApp बॉट तैयार है!</h1>
            <p>आपकी वर्तमान स्थिति: <b>${isOwnerOnline ? 'ऑनलाइन' : 'ऑफ़लाइन'}</b></p>
            <p>बॉट सक्रिय है और मैसेजेस को हैंडल करने के लिए तैयार है।</p>
            <p>स्थिति बदलने के लिए, कृपया Render डैशबोर्ड में एक नई डिप्लॉयमेंट शुरू करें और पर्यावरण चर (environment variable) 'IS_OWNER_ONLINE' को 'true' या 'false' पर सेट करें।</p>
        `);
    } else {
        res.send(`
            <h1>QR कोड स्कैन करें</h1>
            <p>कृपया अपने फ़ोन से WhatsApp खोलें, <b>Linked Devices</b> पर जाएं, और इस QR कोड को स्कैन करें।</p>
            <img src="${qrCodeData}" alt="QR Code" style="border: 2px solid black; padding: 10px;"/>
            <p style="margin-top: 20px;">यदि QR कोड लोड नहीं हो रहा है, तो कृपया Render लॉग्स देखें और कुछ मिनट प्रतीक्षा करें।</p>
        `);
    }
});

// मालिक की स्थिति को बदलने के लिए एक सरल एपीआई एंडपॉइंट
app.get('/toggle_status', (req, res) => {
    isOwnerOnline = !isOwnerOnline;
    saveOwnerStatus();
    res.send(`आपकी स्थिति अब: ${isOwnerOnline ? 'ऑनलाइन' : 'ऑफ़लाइन'}`);
});

// एक्सप्रेस सर्वर को शुरू करें
app.listen(port, () => {
    console.log(`सर्वर http://localhost:${port} पर चल रहा है`);
});

// WhatsApp क्लाइंट को इनिशियलाइज़ करें
client.initialize();
