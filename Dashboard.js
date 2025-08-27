import React, { useState } from "react";

// Broker options
const BROKERS = ["Upstox", "Angel One", "Zerodha", "Groww", "5Paisa"];

// Stock Ticker Map
const STOCK_TICKER_MAP = {
  "RELIANCE INDUSTRIES LTD": "RELIANCE",
  "HDFC BANK LTD": "HDFCBANK",
  "ICICI BANK LTD.": "ICICIBANK",
  "INFOSYS LIMITED": "INFY",
  "TATA CONSULTANCY SERV LT": "TCS",
  "STATE BANK OF INDIA": "SBIN",
  "AXIS BANK LTD": "AXISBANK",
  "KOTAK MAHINDRA BANK LTD": "KOTAKBANK",
  "ITC LTD": "ITC",
  "LARSEN & TOUBRO LTD.": "LT",
  "BAJAJ FINANCE LIMITED": "BAJFINANCE",
  "HINDUSTAN UNILEVER LTD": "HINDUNILVR",
  "SUN PHARMACEUTICAL IND L": "SUNPHARMA",
  "MARUTI SUZUKI INDIA LTD": "MARUTI",
  "NTPC LTD": "NTPC",
  "HCL TECHNOLOGIES LTD": "HCLTECH",
  "ULTRATECH CEMENT LIMITED": "ULTRACEMCO",
  "TATA MOTORS LIMITED": "TATAMOTORS",
  "TITAN COMPANY LIMITED": "TITAN",
  "BHARAT ELECTRONICS LTD": "BEL",
  "POWER GRID CORP. LTD": "POWERGRID",
  "TATA STEEL LIMITED": "TATASTEEL",
  "TRENT LTD": "TRENT",
  "ASIAN PAINTS LIMITED": "ASIANPAINT",
  "JIO FIN SERVICES LTD": "JIOFIN",
  "BAJAJ FINSERV LTD": "BAJAJFINSV",
  "GRASIM INDUSTRIES LTD": "GRASIM",
  "ADANI PORT & SEZ LTD": "ADANIPORTS",
  "JSW STEEL LIMITED": "JSWSTEEL",
  "HINDALCO INDUSTRIES LTD": "HINDALCO",
  "OIL AND NATURAL GAS CORP": "ONGC",
  "TECH MAHINDRA LIMITED": "TECHM",
  "BAJAJ AUTO LIMITED": "BAJAJ-AUTO",
  "SHRIRAM FINANCE LIMITED": "SHRIRAMFIN",
  "CIPLA LTD": "CIPLA",
  "COAL INDIA LTD": "COALINDIA",
  "SBI LIFE INSURANCE CO LTD": "SBILIFE",
  "HDFC LIFE INS CO LTD": "HDFCLIFE",
  "NESTLE INDIA LIMITED": "NESTLEIND",
  "DR. REDDY S LABORATORIES": "DRREDDY",
  "APOLLO HOSPITALS ENTER. L": "APOLLOHOSP",
  "EICHER MOTORS LTD": "EICHERMOT",
  "WIPRO LTD": "WIPRO",
  "TATA CONSUMER PRODUCT LTD": "TATACONSUM",
  "ADANI ENTERPRISES LIMITED": "ADANIENT",
  "HERO MOTOCORP LIMITED": "HEROMOTOCO",
  "INDUSIND BANK LIMITED": "INDUSINDBK",
};

const Dashboard = () => {
  const [numBrokers, setNumBrokers] = useState(0);
  const [numStocks, setNumStocks] = useState(0);

  const [selectedBrokers, setSelectedBrokers] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]);

  const handleBrokerChange = (index, value) => {
    const newBrokers = [...selectedBrokers];
    newBrokers[index] = value;
    setSelectedBrokers(newBrokers);
  };

  const handleStockChange = (index, value) => {
    const newStocks = [...selectedStocks];
    newStocks[index] = value;
    setSelectedStocks(newStocks);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gray-100 p-6">
      {/* Logo Section */}
      <div className="mb-6">
        <img src="/Astya_logo.png" alt="Trading Logo" className="h-20" />
      </div>

      {/* Input Section */}
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-lg mb-6">
        <h2 className="text-xl font-bold mb-4">Trading Setup</h2>

        {/* Number of Brokers */}
        <div className="mb-4">
          <label className="block mb-2 font-medium">Number of Brokers:</label>
          <input
            type="number"
            min="0"
            value={numBrokers}
            onChange={(e) => setNumBrokers(Number(e.target.value))}
            className="w-full border p-2 rounded"
          />
        </div>

        {/* Number of Stocks */}
        <div className="mb-4">
          <label className="block mb-2 font-medium">Number of Stocks:</label>
          <input
            type="number"
            min="0"
            value={numStocks}
            onChange={(e) => setNumStocks(Number(e.target.value))}
            className="w-full border p-2 rounded"
          />
        </div>
      </div>

      {/* Dynamic Broker Dropdowns */}
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-lg mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Brokers</h2>
        {Array.from({ length: numBrokers }).map((_, index) => (
          <select
            key={index}
            className="w-full border p-2 rounded mb-2"
            value={selectedBrokers[index] || ""}
            onChange={(e) => handleBrokerChange(index, e.target.value)}
          >
            <option value="">Select Broker</option>
            {BROKERS.map((broker) => (
              <option key={broker} value={broker}>
                {broker}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Dynamic Stock Dropdowns */}
      <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Select Stocks</h2>
        {Array.from({ length: numStocks }).map((_, index) => (
          <select
            key={index}
            className="w-full border p-2 rounded mb-2"
            value={selectedStocks[index] || ""}
            onChange={(e) => handleStockChange(index, e.target.value)}
          >
            <option value="">Select Stock</option>
            {Object.keys(STOCK_TICKER_MAP).map((stockName) => (
              <option key={stockName} value={STOCK_TICKER_MAP[stockName]}>
                {stockName} ({STOCK_TICKER_MAP[stockName]})
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
