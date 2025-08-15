// app.js

// आवश्यक लाइब्रेरी आयात करें
const { Client, LocalAuth } = require('whatsapp-web.js'); // WhatsApp Web ऑटोमेशन के लिए
const qrcode = require('qrcode-terminal'); // टर्मिनल में QR कोड प्रदर्शित करने के लिए
const fs = require('fs'); // फ़ाइल सिस्टम संचालन के लिए (ऑनलाइन स्थिति को स्टोर करने के लिए)

// WhatsApp क्लाइंट को इनिशियलाइज़ करें
const client = new Client({
    authStrategy: new LocalAuth(), // सत्र डेटा को स्थानीय रूप से संग्रहीत करता है
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Docker/Linux वातावरण के लिए अक्सर आवश्यक
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ],
        // headless: false // यदि आप Puppeteer ब्राउज़र विंडो देखना चाहते हैं तो इसे अनकमेंट करें (डीबगिंग के लिए उपयोगी)
    }
});

// मालिक की ऑनलाइन स्थिति को स्टोर करें (स्थायीता के लिए एक साधारण फ़ाइल-आधारित)
// यदि फ़ाइल मौजूद नहीं है, तो डिफ़ॉल्ट रूप से 'ऑनलाइन' पर सेट करें।
let isOwnerOnline = true; // डिफ़ॉल्ट रूप से ऑनलाइन
const STATUS_FILE = 'owner_status.json';

// फ़ाइल से स्थिति लोड करने के लिए फ़ंक्शन
function loadOwnerStatus() {
    if (fs.existsSync(STATUS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
            isOwnerOnline = data.isOwnerOnline;
            console.log(`मालिक की स्थिति लोड हुई: ${isOwnerOnline ? 'ऑनलाइन' : 'ऑफ़लाइन'}`);
        } catch (error) {
            console.error('मालिक की स्थिति लोड करने में त्रुटि:', error);
        }
    } else {
        saveOwnerStatus(); // यदि फ़ाइल मौजूद नहीं है तो उसे बनाएं
    }
}

// फ़ाइल में स्थिति सहेजने के लिए फ़ंक्शन
function saveOwnerStatus() {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ isOwnerOnline }), 'utf8');
    console.log(`मालिक की स्थिति सहेजी गई: ${isOwnerOnline ? 'ऑनलाइन' : 'ऑफ़लाइन'}`);
}

// स्क्रिप्ट शुरू होने पर स्थिति लोड करें
loadOwnerStatus();

// इवेंट: WhatsApp तैयार है
client.on('ready', () => {
    console.log('WhatsApp क्लाइंट तैयार है!');
    console.log('--- आपका पर्सनल असिस्टेंट बॉट शुरू हुआ ---');
    console.log(`वर्तमान मालिक की स्थिति: ${isOwnerOnline ? 'ऑनलाइन' : 'ऑफ़लाइन'}`);
    console.log('आप इस टर्मिनल में "toggle_status" टाइप करके अपनी ऑनलाइन/ऑफलाइन स्थिति बदल सकते हैं।');
    console.log('बॉट को बंद करने के लिए "exit" टाइप करें।');
});

// इवेंट: WhatsApp QR कोड जेनरेट हुआ
client.on('qr', qr => {
    console.log('QR कोड प्राप्त हुआ। कृपया WhatsApp से स्कैन करें:');
    qrcode.generate(qr, { small: true });
    console.log('ध्यान दें: यह बॉट whatsapp-web.js लाइब्रेरी का उपयोग करता है जो QR कोड का उपयोग करता है, पेयरिंग कोड का नहीं।');
});

// इवेंट: WhatsApp प्रमाणित हो गया
client.on('authenticated', (session) => {
    console.log('WhatsApp प्रमाणित हो गया! सत्र सफलतापूर्वक लोड हुआ।');
});

// इवेंट: WhatsApp प्रमाणीकरण विफल हुआ
client.on('auth_failure', msg => {
    console.error('प्रमाणीकरण विफल हुआ!', msg);
    console.log('कृपया सुनिश्चित करें कि आपका WhatsApp Web सत्र सक्रिय है और फिर से प्रयास करें।');
});

// इवेंट: WhatsApp डिस्कनेक्ट हो गया
client.on('disconnected', (reason) => {
    console.log('WhatsApp डिस्कनेक्ट हो गया:', reason);
    // यदि आप स्वचालित रूप से पुनः कनेक्ट करना चाहते हैं तो client.initialize() को कॉल कर सकते हैं
    // client.initialize();
});

// इवेंट: मैसेज प्राप्त हुआ
client.on('message', async msg => {
    // केवल अन्य यूज़र्स से मैसेज प्रोसेस करें, स्वयं से नहीं
    if (msg.fromMe) {
        return; // आपके द्वारा भेजे गए मैसेज को अनदेखा करें
    }

    const senderNumber = msg.from; // भेजने वाले का पूरा ID (उदाहरण: "91XXXXXXXXXX@c.us")
    const messageBody = msg.body;

    console.log(`[मैसेज प्राप्त] ${senderNumber}: "${messageBody}"`);

    // यदि मालिक ऑफ़लाइन है तो जांचें
    if (!isOwnerOnline) {
        console.log('मालिक ऑफ़लाइन है, बॉट जवाब देगा।');
        let botResponseText = '';

        // साधारण कीवर्ड-आधारित सीमित जवाब
        if (messageBody.toLowerCase().includes('hi') || messageBody.toLowerCase().includes('hello') || messageBody.toLowerCase().includes('नमस्ते')) {
            botResponseText = 'नमस्ते! मैं अभी थोड़ी देर के लिए अनुपलब्ध हूँ। आपका मैसेज महत्वपूर्ण है, मैं जल्द ही आपको जवाब दूंगा।';
        } else if (messageBody.toLowerCase().includes('how are you') || messageBody.toLowerCase().includes('क्या हाल है') || messageBody.toLowerCase().includes('कैसे हो')) {
            botResponseText = 'मैं एक बॉट हूँ और ठीक काम कर रहा हूँ। अभी मेरा मालिक उपलब्ध नहीं है।';
        } else {
            // वास्तविक Google Gemini API कॉल के लिए प्लेसहोल्डर
            // आपको यहां अपनी Google Gemini API कुंजी डालनी होगी
            const GEMINI_API_KEY = "AIzaSyA6Zh5GVB24w7bloM99lfgBhANbMeLO1SM"; // <--- यहां अपनी Gemini API कुंजी डालें (Google AI Studio से प्राप्त करें)

            if (!GEMINI_API_KEY) {
                botResponseText = 'मालिक ऑफ़लाइन है और AI कुंजी कॉन्फ़िगर नहीं है। मैं अभी आपके अनुरोध को संसाधित नहीं कर सकता।';
            } else {
                const prompt = `मुझे इस उपयोगकर्ता के संदेश का एक संक्षिप्त, सहायक जवाब दें, यह मानते हुए कि मेरा मालिक अभी ऑफ़लाइन है और मैं उसका सहायक बॉट हूँ। संदेश: "${messageBody}"`;
                // इस साधारण मुफ्त संस्करण के लिए, हम प्रति उपयोगकर्ता चैट इतिहास को फ़ाइल में बनाए नहीं रखेंगे।
                // संदर्भ के लिए, आपको अधिक मजबूत डेटाबेस की आवश्यकता हो सकती है।
                let chatHistoryForGemini = [];
                chatHistoryForGemini.push({ role: "user", parts: [{ text: prompt }] });

                const payload = { contents: chatHistoryForGemini };
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${GEMINI_API_KEY}`;

                let response;
                let result;
                let retries = 0;
                const maxRetries = 5;
                const baseDelay = 1000; // 1 second

                while (retries < maxRetries) {
                    try {
                        response = await fetch(apiUrl, { // Note: 'fetch' वैश्विक रूप से नवीनतम Node.js संस्करणों में उपलब्ध है
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        result = await response.json();
                        if (result.candidates && result.candidates.length > 0 &&
                            result.candidates[0].content && result.candidates[0].content.parts &&
                            result.candidates[0].content.parts.length > 0) {
                            botResponseText = result.candidates[0].content.parts[0].text;
                            break; // सफलता, लूप से बाहर निकलें
                        } else {
                            console.warn("Gemini API ने अपेक्षित संरचना या सामग्री नहीं लौटाई।", result);
                            botResponseText = 'क्षमा करें, मैं अभी आपके अनुरोध को समझ नहीं पा रहा हूँ। मेरा मालिक जल्द ही वापस आएगा।'; // फॉलबैक
                            break; // इसे संभाला हुआ मानें, लेकिन फॉलबैक के साथ
                        }
                    } catch (error) {
                        console.error(`Gemini API कॉल में त्रुटि (प्रयास ${retries + 1}/${maxRetries}):`, error);
                        retries++;
                        if (retries < maxRetries) {
                            const delay = baseDelay * Math.pow(2, retries - 1);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            console.log(`Gemini API कॉल का पुनः प्रयास कर रहा है (प्रयास ${retries}/${maxRetries})...`);
                        } else {
                            botResponseText = 'क्षमा करें, AI जवाब देने में असमर्थ है। मेरा मालिक जल्द ही वापस आएगा।'; // रिट्री के बाद फॉलबैक
                        }
                    }
                }
            }
        }

        // बॉट का जवाब भेजें
        await client.sendMessage(senderNumber, botResponseText);
        console.log(`[बॉट का जवाब] ${senderNumber}: "${botResponseText}"`);
    } else {
        console.log('मालिक ऑनलाइन है, बॉट जवाब नहीं देगा।');
    }
});

// मालिक की स्थिति को टॉगल करने के लिए कमांड लाइन इंटरफेस
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const command = input.trim();
    if (command === 'toggle_status') {
        isOwnerOnline = !isOwnerOnline;
        saveOwnerStatus(); // नई स्थिति सहेजें
        console.log(`मालिक की स्थिति बदल दी गई: अब आप ${isOwnerOnline ? 'ऑनलाइन' : 'ऑफ़लाइन'} हैं।`);
    } else if (command === 'exit') {
        console.log('बॉट बंद हो रहा है...');
        client.destroy(); // WhatsApp क्लाइंट को बंद करें
        process.exit(0); // प्रक्रिया से बाहर निकलें
    } else {
        console.log('अमान्य कमांड। "toggle_status" या "exit" टाइप करें।');
    }
});

// WhatsApp क्लाइंट को इनिशियलाइज़ करें
client.initialize();
