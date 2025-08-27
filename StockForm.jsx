// src/components/StockForm.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";

function StockForm({
  stockIndex,
  stockName, // This prop now receives the short ticker (e.g., "HDFCBANK")
  associatedBroker,
  lots,
  totalShares,
  interval,
  targetPercentage,
  onStockChange,
  availableBrokers,
  brokerThemes
}) {
  // Local states for form inputs, directly controlled by user interaction
  const [selectedStockTicker, setSelectedStockTicker] = useState(stockName || "");
  const [selectedAssociatedBroker, setSelectedAssociatedBroker] = useState(associatedBroker || "");
  const [numLots, setNumLots] = useState(lots || 1);
  const [selectedInterval, setSelectedInterval] = useState(interval || 5);
  const [pctTarget, setPctTarget] = useState(targetPercentage || 0);

  // Derived/fetched states
  const [lotSize, setLotSize] = useState(0);
  const [numTotalShares, setNumTotalShares] = useState(totalShares || 0); // Display state
  const [loadingLotSize, setLoadingLotSize] = useState(false);

  // --- Effect 1: Synchronize internal state with incoming props ---
  // This useEffect ensures the local state updates ONLY when the parent's props
  // for this specific component instance actually change. This is crucial to
  // prevent external re-renders from overriding user's active input.
  useEffect(() => {
    if (stockName !== selectedStockTicker) {
      setSelectedStockTicker(stockName || "");
    }
    if (associatedBroker !== selectedAssociatedBroker) {
      setSelectedAssociatedBroker(associatedBroker || "");
    }
    if (lots !== numLots) {
      setNumLots(lots || 1);
    }
    if (totalShares !== numTotalShares) {
      setNumTotalShares(totalShares || 0);
    }
    if (interval !== selectedInterval) {
      setSelectedInterval(interval || 5);
    }
    if (targetPercentage !== pctTarget) {
      setPctTarget(targetPercentage || 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockIndex, stockName, associatedBroker, lots, totalShares, interval, targetPercentage]);
  // The local state variables (e.g., selectedStockTicker) are intentionally omitted from dependencies
  // to prevent re-triggering this effect when the local state updates *from within this effect*.
  // This pattern is acceptable for prop-syncing effects, hence the eslint-disable.


  // Backend API URL
  const BACKEND_INSTRUMENT_DETAILS_URL = "http://localhost:8001/api/brokers/instrument-details";

  // Memoized stock ticker map for stability
  const STOCK_TICKER_MAP = useMemo(() => ({
    "RELIANCE INDUSTRIES LTD": "RELIANCE", "HDFC BANK LTD": "HDFCBANK", "ICICI BANK LTD.": "ICICIBANK",
    "INFOSYS LIMITED": "INFY", "TATA CONSULTANCY SERV LT": "TCS", "STATE BANK OF INDIA": "SBIN",
    "AXIS BANK LTD": "AXISBANK", "KOTAK MAHINDRA BANK LTD": "KOTAKBANK", "ITC LTD": "ITC",
    "LARSEN & TOUBRO LTD.": "LT", "BAJAJ FINANCE LIMITED": "BAJFINANCE", "HINDUSTAN UNILEVER LTD": "HINDUNILVR",
    "SUN PHARMACEUTICAL IND L": "SUNPHARMA", "MARUTI SUZUKI INDIA LTD": "MARUTI", "NTPC LTD": "NTPC",
    "HCL TECHNOLOGIES LTD": "HCLTECH", "ULTRATECH CEMENT LIMITED": "ULTRACEMCO", "TATA MOTORS LIMITED": "TATAMOTORS",
    "TITAN COMPANY LIMITED": "TITAN", "BHARAT ELECTRONICS LTD": "BEL", "POWER GRID CORP. LTD": "POWERGRID",
    "TATA STEEL LIMITED": "TATASTEEL", "TRENT LTD": "TRENT", "ASIAN PAINTS LIMITED": "ASIANPAINT",
    "JIO FIN SERVICES LTD": "JIOFIN", "BAJAJ FINSERV LTD": "BAJAJFINSV", "GRASIM INDUSTRIES LTD": "GRASIM",
    "ADANI PORT & SEZ LTD": "ADANIPORTS", "JSW STEEL LIMITED": "JSWSTEEL", "HINDALCO INDUSTRIES LTD": "HINDALCO",
    "OIL AND NATURAL GAS CORP": "ONGC", "TECH MAHINDRA LIMITED": "TECHM", "BAJAJ AUTO LIMITED": "BAJAJ-AUTO",
    "SHRIRAM FINANCE LIMITED": "SHRIRAMFIN", "CIPLA LTD": "CIPLA", "COAL INDIA LTD": "COALINDIA",
    "SBI LIFE INSURANCE CO LTD": "SBILIFE", "HDFC LIFE INS CO LTD": "HDFCLIFE", "NESTLE INDIA LIMITED": "NESTLEIND",
    "DR. REDDY S LABORATORIES": "DRREDDY", "APOLLO HOSPITALS ENTER. L": "APOLLOHOSP", "EICHER MOTORS LTD": "EICHERMOT",
    "WIPRO LTD": "WIPRO", "TATA CONSUMER PRODUCT LTD": "TATACONSUM", "ADANI ENTERPRISES LIMITED": "ADANIENT",
    "HERO MOTOCORP LIMITED": "HEROMOTOCO", "INDUSINDBK": "INDUSINDBK", "Nifty 50": "NIFTY",
    "Nifty Bank": "BANKNIFTY", "Nifty Fin Service": "FINNIFTY", "NIFTY MID SELECT": "MIDCPNIFTY",
  }), []);

  // Helper to get the full name from the short ticker value
  const getFullNameFromTicker = useCallback((ticker) => {
    for (const [fullName, tickerValue] of Object.entries(STOCK_TICKER_MAP)) {
      if (tickerValue === ticker) {
        return fullName;
      }
    }
    return ticker;
  }, [STOCK_TICKER_MAP]);

  // Memoized callback to trigger parent's onStockChange with all current stock details
  const triggerParentUpdate = useCallback((newDetails = {}) => {
    onStockChange({
      name: selectedStockTicker,
      associatedBroker: selectedAssociatedBroker,
      lots: numLots, // Use current local numLots
      interval: selectedInterval,
      targetPercentage: pctTarget,
      ...newDetails,
    });
  }, [onStockChange, selectedStockTicker, selectedAssociatedBroker, numLots, selectedInterval, pctTarget]); // Removed stockIndex as it's not directly used in the output of this function

  // --- Effect 2: Fetch lot size from backend when stock or broker changes ---
  useEffect(() => {
    const fetchAndSetLotSize = async () => {
      if (!selectedStockTicker || !selectedAssociatedBroker) {
        setLotSize(0);
        setLoadingLotSize(false);
        return; // Early exit, no need to proceed with fetch or updates
      }

      setLoadingLotSize(true);
      try {
        const fullStockNameForBackend = getFullNameFromTicker(selectedStockTicker);

        const response = await fetch(BACKEND_INSTRUMENT_DETAILS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            broker_name: selectedAssociatedBroker,
            stock_name_for_lookup: fullStockNameForBackend,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setLotSize(data.lot_size);
        
      } catch (error) {
        console.error(`[StockForm ${stockIndex}] Error fetching lot size:`, error);
        setLotSize(0); // Reset lot size on error
      } finally {
        setLoadingLotSize(false);
      }
    };

    fetchAndSetLotSize(); // Call the async function
  }, [selectedStockTicker, selectedAssociatedBroker, BACKEND_INSTRUMENT_DETAILS_URL, getFullNameFromTicker, stockIndex]);
  // Dependencies are only what's needed to re-fetch lotSize.

  // --- Effect 3: Calculate and update total shares when numLots or lotSize changes ---
  useEffect(() => {
    const calculatedTotal = numLots * lotSize;

    // Only update if the calculated total is different from the current display state.
    // This prevents unnecessary re-renders when parent might send back the same totalShares.
    if (calculatedTotal !== numTotalShares) {
      setNumTotalShares(calculatedTotal);
      triggerParentUpdate({ totalShares: calculatedTotal, lots: numLots });
    }
  }, [numLots, lotSize, numTotalShares, triggerParentUpdate, stockIndex]);
  // Dependencies are numLots (user input), lotSize (from fetch), numTotalShares (for comparison).


  const theme = brokerThemes[selectedAssociatedBroker] || { bg: "bg-white", text: "text-gray-700" };

  // --- Handlers for User Input ---

  const handleStockChange = (e) => {
    const newStockTicker = e.target.value;
    setSelectedStockTicker(newStockTicker);
    // Reset derived states (lotSize will be re-fetched by Effect 2)
    // numTotalShares will be recalculated by Effect 3
    setNumLots(1); // Default to 1 lot for new stock
    // Immediately inform parent of changes to stock name and default lots
    triggerParentUpdate({ name: newStockTicker, lots: 1, totalShares: 0 }); // Explicitly reset totalShares in parent
  };

  const handleBrokerChange = (e) => {
    const newBroker = e.target.value;
    setSelectedAssociatedBroker(newBroker);
    // Reset derived states (lotSize will be re-fetched by Effect 2)
    // numTotalShares will be recalculated by Effect 3
    // Immediately inform parent of changes to associated broker
    triggerParentUpdate({ associatedBroker: newBroker, totalShares: 0 }); // Explicitly reset totalShares in parent
  };

  const handleLotsChange = (e) => {
    const value = e.target.value === '' ? '' : Number(e.target.value); // Allow empty string for backspace
    setNumLots(value);
    // The useEffect monitoring numLots will handle propagating to parent
    // and recalculating total shares.
  };

  const handleIntervalChange = (e) => {
    const value = Number(e.target.value);
    setSelectedInterval(value);
    triggerParentUpdate({ interval: value });
  };

  const handleTargetPercentageChange = (e) => {
    const value = Number(e.target.value);
    setPctTarget(value);
    triggerParentUpdate({ targetPercentage: value });
  };


  return (
    <div className={`p-4 border rounded-lg shadow-md bg-white flex flex-col md:flex-row md:flex-wrap md:items-center space-y-4 md:space-y-0 md:space-x-4 w-full transition-all duration-300 ease-in-out`}>
      <h3 className="text-lg font-semibold text-gray-800 w-full md:w-auto">Stock {stockIndex + 1}</h3>

      {/* Stock Dropdown */}
      <div className="flex-1 min-w-[180px]">
        <label htmlFor={`stock-ticker-${stockIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Select Stock</label>
        <select
          id={`stock-ticker-${stockIndex}`}
          value={selectedStockTicker}
          onChange={handleStockChange}
          className={`border rounded-md p-2 w-full font-medium focus:outline-none focus:ring-2
            ${theme.bg} ${theme.text} placeholder-gray-500 transition-colors duration-200 ease-in-out`}
        >
          <option value="">-- Select Stock --</option>
          {Object.entries(STOCK_TICKER_MAP).map(([label, value], idx) => (
            <option key={idx} value={value}>
              {label} ({value})
            </option>
          ))}
        </select>
      </div>

      {/* Broker Dropdown for Assignment */}
      <div className="flex-1 min-w-[180px]">
        <label htmlFor={`assign-broker-${stockIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Assign Broker</label>
        <select
          id={`assign-broker-${stockIndex}`}
          value={selectedAssociatedBroker}
          onChange={handleBrokerChange}
          className={`border rounded-md p-2 w-full font-medium focus:outline-none focus:ring-2
            ${theme.bg} ${theme.text} placeholder-gray-500 transition-colors duration-200 ease-in-out`}
        >
          <option value="">-- Assign Broker --</option>
          {availableBrokers.length > 0 ? (
            availableBrokers.map((brokerValue, idx) => (
              <option key={idx} value={brokerValue}>
                {brokerValue}
              </option>
            ))
          ) : (
            <option value="" disabled>No brokers available</option>
          )}
        </select>
        {availableBrokers.length === 0 && (
          <p className="text-xs text-red-500 mt-1">Please add and select brokers above first.</p>
        )}
      </div>

      {/* Number of Lots to Trade */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor={`num-lots-${stockIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Lots to Trade</label>
        <input
          id={`num-lots-${stockIndex}`}
          type="number"
          value={numLots}
          onChange={handleLotsChange}
          className="border rounded-md p-2 w-full shadow-sm focus:ring-orange-500 focus:border-orange-500"
          min="1"
        />
      </div>

      {/* Total Shares as a message label */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor={`total-shares-${stockIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Total Shares</label>
        <div
          id={`total-shares-${stockIndex}`}
          className={`border rounded-md p-2 w-full bg-gray-50 text-gray-800 font-medium cursor-default
                      ${loadingLotSize ? 'animate-pulse text-gray-500' : ''}`}
        >
          {loadingLotSize ? "Loading..." : numTotalShares}
        </div>
      </div>

      {/* Interval (minutes) */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor={`interval-${stockIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Interval (min)</label>
        <select
          id={`interval-${stockIndex}`}
          value={selectedInterval}
          onChange={handleIntervalChange}
          className="border rounded-md p-2 w-full shadow-sm focus:ring-orange-500 focus:border-orange-500"
        >
          <option value="1">1</option>
          <option value="5">5</option>
          <option value="15">15</option>
          <option value="30">30</option>
          <option value="60">60</option>
        </select>
      </div>

      {/* Target Percentage */}
      <div className="flex-1 min-w-[160px]">
        <label htmlFor={`target-pct-${stockIndex}`} className="block text-sm font-medium text-gray-700 mb-1">Target %</label>
        <input
          id={`target-pct-${stockIndex}`}
          type="number"
          value={pctTarget}
          onChange={handleTargetPercentageChange}
          className="border rounded-md p-2 w-full shadow-sm focus:ring-orange-500 focus:border-orange-500"
          step="0.01"
          min="0"
        />
      </div>
    </div>
  );
}

export default StockForm;
