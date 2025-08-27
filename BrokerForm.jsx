// src/components/BrokerForm.jsx
import React, { useState } from "react";

function BrokerForm({ brokerIndex, selectedBroker, onBrokerChange, brokerThemes }) {
  // State for broker-specific credentials
  const [upstoxAccessToken, setUpstoxAccessToken] = useState("");
  const [angelApiKey, setAngelApiKey] = useState("");
  const [angelClientCode, setAngelClientCode] = useState("");
  const [angelPin, setAngelPin] = useState("");
  const [angelTotpSecret, setAngelTotpSecret] = useState("");
  const [zerodhaApiKey, setZerodhaApiKey] = useState("");
  const [zerodhaAccessToken, setZerodhaAccessToken] = useState("");

  const [isConnected, setIsConnected] = useState(false); // Tracks connection status
  const [loading, setLoading] = useState(false); // Indicates loading state during connection

  // State for Profile details
  const [userId, setUserId] = useState("N/A");
  const [userName, setUserName] = useState("N/A");
  const [userEmail, setUserEmail] = useState("N/A");

  // State for Balance details
  const [totalBalance, setTotalBalance] = useState("N/A");
  const [marginUsed, setMarginUsed] = useState("N/A");
  const [availableBalance, setAvailableBalance] = useState("N/A");

  // Backend API URL - IMPORTANT: Adjust if your backend is on a different host/port
  const BACKEND_URL = "http://localhost:8001/api/brokers/connect"; 

  // Use the passed-in brokerThemes to determine the current theme
  const theme = brokerThemes[selectedBroker] || { bg: "bg-white", text: "text-gray-700" };

  // Handler for the Connect button click
  const handleConnect = async () => {
    setLoading(true); // Set loading to true when connecting
    setIsConnected(false); // Reset connection status

    let requestBody = {
      broker_name: selectedBroker,
    };

    // Populate request body with relevant credentials based on selected broker
    switch (selectedBroker) {
      case "Upstox":
        if (!upstoxAccessToken) {
          alert("Upstox Access Token is required.");
          setLoading(false);
          return;
        }
        requestBody.upstoxAccessToken = upstoxAccessToken;
        break;
      case "AngelOne":
        if (!(angelApiKey && angelClientCode && angelPin && angelTotpSecret)) {
          alert("Angel One: API Key, Client Code, PIN, and TOTP Secret are required.");
          setLoading(false);
          return;
        }
        requestBody.angelApiKey = angelApiKey;
        requestBody.angelClientCode = angelClientCode;
        requestBody.angelPin = angelPin;
        requestBody.angelTotpSecret = angelTotpSecret;
        break;
      case "Zerodha":
        if (!(zerodhaApiKey && zerodhaAccessToken)) {
          alert("Zerodha: API Key and Access Token are required.");
          setLoading(false);
          return;
        }
        requestBody.zerodhaApiKey = zerodhaApiKey;
        requestBody.zerodhaAccessToken = zerodhaAccessToken;
        break;
      default:
        alert("Please select a valid broker.");
        setLoading(false);
        return;
    }

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      if (data.is_connected) {
        setIsConnected(true);
        setUserId(data.user_id);
        setUserName(data.user_name);
        setUserEmail(data.user_email);
        setTotalBalance(data.total_balance);
        setMarginUsed(data.margin_used);
        setAvailableBalance(data.available_balance);
        alert(`Successfully connected to ${selectedBroker}!`);
      } else {
        alert(`Failed to connect to ${selectedBroker}. Please check credentials.`);
      }

    } catch (error) {
      console.error("Connection error:", error);
      alert(`Error connecting to ${selectedBroker}: ${error.message}`);
      setIsConnected(false);
    } finally {
      setLoading(false); // Set loading to false after connection attempt
    }
  };

  // Resets all credential states and connection status
  const resetConnectionState = () => {
    setUpstoxAccessToken("");
    setAngelApiKey("");
    setAngelClientCode("");
    setAngelPin("");
    setAngelTotpSecret("");
    setZerodhaApiKey("");
    setZerodhaAccessToken("");
    setIsConnected(false);
    setLoading(false);
    setUserId("N/A");
    setUserName("N/A");
    setUserEmail("N/A");
    setTotalBalance("N/A");
    setMarginUsed("N/A");
    setAvailableBalance("N/A");
  };

  return (
    <div className="p-4 border rounded-lg shadow-md w-full bg-white transition-all duration-300 ease-in-out">
      <h3 className="text-lg font-semibold mb-3 text-gray-800">Broker {brokerIndex + 1}</h3>
      
      {/* Combined row for Broker Selection, Credentials, Connect Button, Profile, and Balance */}
      <div className="flex flex-col xl:flex-row xl:items-start space-y-4 xl:space-y-0 xl:space-x-4 w-full"> 
        {/* Broker Selection, Inline Credentials, and Connect Button Group */}
        <div className="flex flex-col lg:flex-row lg:items-center space-y-3 lg:space-y-0 lg:space-x-3 flex-grow-0 min-w-[300px]">
          {/* Broker Selection Dropdown */}
          <div className="flex-none w-full lg:w-40"> 
            <label htmlFor={`broker-select-${brokerIndex}`} className="block text-sm font-medium text-gray-700 mb-1 sr-only">
              Select Broker
            </label>
            <select
              id={`broker-select-${brokerIndex}`}
              value={selectedBroker} 
              onChange={(e) => {
                onBrokerChange(e.target.value);
                resetConnectionState(); // Reset all states on broker change
              }}
              className={`border rounded-md p-2 w-full font-medium focus:outline-none focus:ring-2 
                ${theme.bg} ${theme.text} placeholder-gray-500 transition-colors duration-200 ease-in-out`}
              disabled={loading} // Disable broker selection during loading
            >
              <option value="">-- Select Broker --</option>
              <option value="Upstox">Upstox</option>
              <option value="AngelOne">Angel One</option>
              <option value="Zerodha">Zerodha</option>
              <option value="Groww">Groww</option>
              <option value="5Paisa">5Paisa</option>
              <option value="AliceBlue">Alice Blue</option>
            </select>
          </div>
          
          {/* Dynamic Credential Inputs and Connect Button - displayed only if a broker is selected */}
          {selectedBroker && (
            <div className="flex flex-col sm:flex-row flex-grow space-y-2 sm:space-y-0 sm:space-x-2 items-center">
              {/* Conditional Inputs based on selectedBroker */}
              {selectedBroker === "Upstox" && (
                <input
                  type="password" // Masked input
                  placeholder="Access Token"
                  value={upstoxAccessToken}
                  onChange={(e) => setUpstoxAccessToken(e.target.value)}
                  className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                    ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                  disabled={isConnected || loading}
                />
              )}

              {selectedBroker === "AngelOne" && (
                <>
                  <input
                    type="password" // Masked input
                    placeholder="API Key"
                    value={angelApiKey}
                    onChange={(e) => setAngelApiKey(e.target.value)}
                    className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                      ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                    disabled={isConnected || loading}
                  />
                  <input
                    type="text"
                    placeholder="Client Code"
                    value={angelClientCode}
                    onChange={(e) => setAngelClientCode(e.target.value)}
                    className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                      ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                    disabled={isConnected || loading}
                  />
                  <input
                    type="password" // Masked input
                    placeholder="PIN"
                    value={angelPin}
                    onChange={(e) => setAngelPin(e.target.value)}
                    className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                      ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                    disabled={isConnected || loading}
                  />
                  <input
                    type="password" // Masked input
                    placeholder="TOTP Secret"
                    value={angelTotpSecret}
                    onChange={(e) => setAngelTotpSecret(e.target.value)}
                    className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                      ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                    disabled={isConnected || loading}
                  />
                </>
              )}

              {selectedBroker === "Zerodha" && (
                <>
                  <input
                    type="password" // Masked input
                    placeholder="API Key"
                    value={zerodhaApiKey}
                    onChange={(e) => setZerodhaApiKey(e.target.value)}
                    className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                      ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                    disabled={isConnected || loading}
                  />
                  <input
                    type="text"
                    placeholder="Access Token"
                    value={zerodhaAccessToken}
                    onChange={(e) => setZerodhaAccessToken(e.target.value)}
                    className={`border rounded-md p-2 w-full sm:flex-1 focus:outline-none focus:ring-1 
                      ${theme.bg} ${theme.text} bg-opacity-50 placeholder-${theme.text.split('-')[1]}-600`}
                    disabled={isConnected || loading}
                  />
                </>
              )}

              <button
                onClick={handleConnect}
                className={`px-4 py-2 rounded-md font-semibold text-white shadow-md hover:shadow-lg 
                  transition-all duration-200 ease-in-out ${isConnected ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'} focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-75`}
                disabled={!selectedBroker || isConnected || loading} // Disable if no broker selected, already connected, or loading
              >
                {loading ? 'Connecting...' : (isConnected ? 'Connected' : 'Connect')}
              </button>
            </div>
          )}
        </div>

        {/* Profile and Balance Displays - visible only if a broker is selected and connected */}
        {selectedBroker && isConnected && (
          <div className={`mt-4 xl:mt-0 p-3 rounded-md ${theme.bg} ${theme.text} bg-opacity-70 flex flex-col md:flex-row md:space-x-6 space-y-4 md:space-y-0 flex-grow transition-all duration-200 ease-in-out`}>
            {/* Profile Section */}
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2">Profile:</p>
              <p className="text-xs"><strong>User ID:</strong> {userId}</p>
              <p className="text-xs"><strong>Name:</strong> {userName}</p>
              <p className="text-xs"><strong>Email:</strong> {userEmail}</p>
            </div>
            
            {/* Balance Section */}
            <div className="flex-1">
              <p className="text-sm font-semibold mb-2">Balance:</p>
              <p className="text-xs"><strong>Total Balance:</strong> {totalBalance}</p>
              <p className="text-xs"><strong>Margin Used:</strong> {marginUsed}</p>
              <p className="text-xs"><strong>Available Balance:</strong> {availableBalance}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrokerForm;
