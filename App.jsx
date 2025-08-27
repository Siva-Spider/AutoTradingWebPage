// src/App.jsx
import React, { useState } from "react";
// IMPORTANT: Please verify these import paths and file/folder casing carefully.
// The paths are relative to the current file (App.jsx in src/).
// Corrected paths to explicitly reference .jsx files
import BrokerForm from "./components/BrokerForm.jsx";
import StockForm from "./components/StockForm.jsx";

// IMPORTANT: Ensure 'astya-logo.png' is placed directly in your 'frontend/public/' directory for direct reference.

// Define broker themes using lighter shades for dynamic application
const brokerThemes = {
  Upstox: { bg: "bg-purple-200", text: "text-purple-800" },
  Zerodha: { bg: "bg-yellow-100", text: "text-yellow-800" }, // creamy shade
  AngelOne: { bg: "bg-green-200", text: "text-green-800" },
  AliceBlue: { bg: "bg-sky-200", text: "text-sky-800" },
  Groww: { bg: "bg-blue-200", text: "text-blue-800" },
  "5Paisa": { bg: "bg-red-200", text: "text-red-800" },
};

function App() {
  const [numBrokers, setNumBrokers] = useState(0);
  const [numStocks, setNumStocks] = useState(0);
  const [brokers, setBrokers] = useState(Array(0).fill("")); // Stores selected broker names

  // `stocks` will now store an object for each stock, including trading parameters
  const [stocks, setStocks] = useState(Array(0).fill({
    name: "",
    associatedBroker: "",
    lots: 1, // Default lots
    totalShares: 0, // Default total shares
    interval: 5, // Default interval (minutes)
    targetPercentage: 0, // Default target percentage
  }));


  // Ensures the brokers array grows/shrinks with the input number, maintaining selections
  const handleNumBrokersChange = (e) => {
    const value = Number(e.target.value) || 0;
    setNumBrokers(value);
    setBrokers((prev) => {
      const updated = [...prev];
      if (value > prev.length) {
        for (let i = prev.length; i < value; i++) updated.push("");
      } else {
        updated.length = value;
      }
      return updated;
    });
  };

  // Ensures the stocks array grows/shrinks with the input number
  const handleNumStocksChange = (e) => {
    const value = Number(e.target.value) || 0;
    setNumStocks(value);
    setStocks((prev) => {
      const updated = [...prev];
      if (value > prev.length) {
        // Add new stock objects with default trading parameters
        for (let i = prev.length; i < value; i++) updated.push({
          name: "",
          associatedBroker: "",
          lots: 1,
          totalShares: 0,
          interval: 5,
          targetPercentage: 0,
        });
      } else {
        // Trim array if fewer stocks are specified
        updated.length = value;
      }
      return updated;
    });
  };

  // Function to map a stock ticker (e.g., RELIANCE) to an instrument key recognized by the trading script
  // This is a simplified mapping for indices, as the provided trading script's 'fetch_option_data'
  // uses index names (NIFTY, BANKNIFTY) to derive option instrument keys.
  const getInstrumentKeyForTrading = (stockTicker) => {
    switch (stockTicker) {
      case "NIFTY": return "NSE_INDEX|Nifty 50";
      case "BANKNIFTY": return "NSE_INDEX|Nifty Bank";
      case "FINNIFTY": return "NSE_INDEX|Nifty Fin Service";
      case "MIDCPNIFTY": return "NSE_INDEX|NIFTY MID SELECT";
      // IMPORTANT: For actual stock tickers (like RELIANCE, HDFCBANK), you would need
      // a more robust lookup mechanism, possibly another API call to Upstox instruments.
      // For now, only major indices are supported for auto-trading.
      default: return "";
    }
  };

  const handleStartTrade = async (stockData) => {
    // Basic validation
    if (!stockData.name || !stockData.associatedBroker) {
      alert("Please select a stock and assign a broker first.");
      return;
    }
    if (stockData.lots <= 0) {
      alert("Number of Lots to Trade must be greater than 0.");
      return;
    }
    if (stockData.interval <= 0) {
      alert("Candle Interval must be greater than 0.");
      return;
    }

    const instrumentKey = getInstrumentKeyForTrading(stockData.name);
    if (!instrumentKey) {
      alert(`Could not find instrument key for stock: ${stockData.name}. Trading is currently limited to major indices for demonstration.`);
      return;
    }

    // IMPORTANT: This accessTokenPlaceholder needs to be replaced with the actual
    // access token obtained from the connected Upstox BrokerForm.
    // In a real application, you would lift the state of the Upstox access token
    // from BrokerForm to App.jsx (or a shared context).
    const accessTokenPlaceholder = "YOUR_UPSTOX_ACCESS_TOKEN_HERE";

    if (stockData.associatedBroker !== "Upstox") {
      alert("Auto-trading script currently supports only Upstox for live trading.");
      return;
    }

    if (accessTokenPlaceholder === "YOUR_UPSTOX_ACCESS_TOKEN_HERE") {
      alert("Please connect to Upstox first and ensure its access token is correctly passed to the trading function. (Update the accessTokenPlaceholder in App.jsx)");
      return;
    }

    const requestBody = {
      broker_name: stockData.associatedBroker,
      instrument_key_index: instrumentKey,
      index_name: stockData.name, // The trading script uses this for NIFTY/BANKNIFTY logic
      interval: stockData.interval, // Now per-stock
      lots: stockData.lots,       // Now per-stock
      // totalShares: stockData.totalShares, // To be used in backend logic later
      // targetPercentage: stockData.targetPercentage, // To be used in backend logic later
    };

    const BACKEND_TRADE_URL = "http://localhost:8001/api/brokers/trade/start";

    try {
      const response = await fetch(BACKEND_TRADE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Add Authorization header with user token if your backend requires it
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `HTTP error! status: ${response.status}`);
      }

      alert(data.message);
      console.log("Trade initiation response:", data);

    } catch (error) {
      console.error("Error starting trade:", error);
      alert(`Error starting trade: ${error.message}`);
    }
  };


  return (
    <div className="min-h-screen w-full bg-orange-100 flex flex-col items-start p-6 space-y-6 rounded-lg font-inter">
      {/* Logo */}
      <div className="mb-4">
        <img src="/astya_logo.png" alt="Astya Logo" className="h-20 rounded-md shadow-md" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/80x80/FFEDD5/D97706?text=Astya"; }}/>
      </div>

      {/* Number of Brokers Input */}
      <div className="w-full max-w-md">
        <label htmlFor="numBrokersInput" className="block text-gray-700 font-semibold mb-2">
          Number of Brokers:
        </label>
        <input
          id="numBrokersInput"
          type="number"
          value={numBrokers}
          onChange={handleNumBrokersChange}
          className="border rounded-md p-2 w-40 shadow-sm focus:ring-orange-500 focus:border-orange-500"
          min="0"
        />
      </div>

      {/* Broker Forms Section */}
      <div className="flex flex-col space-y-4 w-full">
        {brokers.map((brokerName, index) => (
          <BrokerForm
            key={index}
            brokerIndex={index}
            selectedBroker={brokerName}
            onBrokerChange={(newVal) => {
              setBrokers((prev) => {
                const updated = [...prev];
                updated[index] = newVal;
                return updated;
              });
            }}
            brokerThemes={brokerThemes}
          />
        ))}
      </div>

      {/* Number of Stocks Input */}
      <div className="w-full mt-6 max-w-md">
        <label htmlFor="numStocksInput" className="block text-gray-700 font-semibold mb-2">
          Number of Stocks:
        </label>
        <input
          id="numStocksInput"
          type="number"
          value={numStocks}
          onChange={handleNumStocksChange}
          className="border rounded-md p-2 w-40 shadow-sm focus:ring-orange-500 focus:border-orange-500"
          min="0"
        />
      </div>

      {/* Stock Forms Section */}
      <div className="flex flex-col space-y-4 w-full">
        {stocks.map((stockData, index) => (
          <div key={index} className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 w-full items-end">
            <StockForm
              stockIndex={index}
              stockName={stockData.name}
              associatedBroker={stockData.associatedBroker}
              lots={stockData.lots} // Pass lots prop
              totalShares={stockData.totalShares} // Pass totalShares prop
              interval={stockData.interval} // Pass interval prop
              targetPercentage={stockData.targetPercentage} // Pass targetPercentage prop
              onStockChange={(newStockDetails) => { // Updated to receive an object
                setStocks((prev) => {
                  const updated = [...prev];
                  updated[index] = { ...updated[index], ...newStockDetails }; // Merge new details
                  return updated;
                });
              }}
              availableBrokers={brokers.filter(b => b !== "")}
              brokerThemes={brokerThemes}
            />
            <button
              onClick={() => handleStartTrade(stockData)}
              className="px-6 py-2 rounded-md font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
            >
              Start Trade
            </button>
            {/* You might add a Stop Trade button here later */}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
