// API helper function - updated URL
async function postJSON(data) {
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycby-XLAHGZeXtEGGFuPuVNsi95onx4Muwc8lc_8qf6N7EJc9diM2Zm7EO5qo2X4ejUz6/exec', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: error.message };
  }
}