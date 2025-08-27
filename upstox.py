# backend/app/brokers/upstox.py
import requests
import logging
from fastapi import HTTPException
import asyncio
import pandas as pd
import datetime
import pytz
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class UpstoxBroker:
    BASE_URL = "https://api.upstox.com/v2"  # Old base URL for balance/profile
    V3_BASE_URL = "https://api.upstox.com/v3"  # New base URL for historical/intraday/ohlc candles

    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.access_token}',
            'Api-Version': '2.0'  # For v2 endpoints (profile, funds)
        }
        self.v3_headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.access_token}'
            # V3 endpoints might not strictly need Api-Version header, but good to check Upstox docs
        }
        # Cache for instrument details DataFrame to avoid re-reading CSV multiple times
        self._instruments_df = None

    async def _load_instruments_df(self) -> pd.DataFrame:
        if self._instruments_df is not None:
            return self._instruments_df
        try:
            # Download and load the Upstox complete instrument master CSV
            df = await asyncio.to_thread(
                pd.read_csv, "https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz"
            )
            df['expiry'] = pd.to_datetime(df['expiry'], errors='coerce').dt.date
            self._instruments_df = df
            logger.info("Upstox instrument CSV loaded successfully.")
            return self._instruments_df
        except Exception as e:
            logger.error(f"Failed to download or parse Upstox instrument CSV: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load instrument data: {e}")

    # --- Profile and Balance (Existing functionality) ---
    async def fetch_profile(self):
        """Fetches user profile details from Upstox."""
        url = f'{self.BASE_URL}/user/profile'
        await asyncio.sleep(0.1)  # Small delay for async context
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Upstox Profile Response: {data}")
            if data.get('status') == 'success' and 'data' in data:
                profile_data = {
                    "userId": data['data'].get('user_id', 'N/A'),
                    "name": data['data'].get('user_name', 'N/A'),
                    "email": data['data'].get('email_id', 'N/A'),
                }
                return profile_data
            else:
                logger.error(f"Upstox profile fetch failed: Invalid response structure. Response: {data}")
                raise HTTPException(status_code=500,
                                    detail="Failed to retrieve Upstox profile: Invalid response structure.")
        except requests.exceptions.HTTPStatusError as e:
            logger.error(f"Upstox profile fetch failed (HTTP): {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Upstox API error: {e.response.text}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Upstox profile fetch failed (Request): {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to Upstox API: {e}")
        except Exception as e:
            logger.error(f"Upstox profile fetch unexpected error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to fetch Upstox profile due to internal error.")

    async def fetch_balance(self):
        """Fetches user funds and margin details from Upstox."""
        url = f'{self.BASE_URL}/user/get-funds-and-margin'
        await asyncio.sleep(0.1)  # Small delay for async context
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Upstox Balance Response: {data}")
            if data.get('status') == 'success' and 'data' in data:
                equity_data = data['data'].get('equity', {})
                available_margin = equity_data.get('available_margin', 0)
                used_margin = equity_data.get('used_margin', 0)
                total_balance = available_margin + used_margin
                balance_data = {
                    "totalBalance": f"₹ {total_balance:,.2f}",
                    "marginUsed": f"₹ {used_margin:,.2f}",
                    "availableBalance": f"₹ {available_margin:,.2f}",
                }
                return balance_data
            else:
                logger.error(f"Upstox balance fetch failed: Invalid response structure. Response: {data}")
                raise HTTPException(status_code=500,
                                    detail="Failed to retrieve Upstox balance: Invalid response structure.")
        except requests.exceptions.HTTPStatusError as e:
            logger.error(f"Upstox balance fetch failed (HTTP): {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Upstox API error: {e.response.text}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Upstox balance fetch failed (Request): {e}")
            raise HTTPException(status_code=500, detail=f"Failed to connect to Upstox API: {e}")
        except Exception as e:
            logger.error(f"Upstox balance fetch unexpected error: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to fetch Upstox profile due to internal error.")

    # --- Trading-specific methods (New interface for trading_core.py) ---
    async def fetch_historical_data(self, instrument_key: str, interval: int) -> pd.DataFrame:
        """Fetches historical OHLC data for the given instrument and interval."""
        return await asyncio.to_thread(self._fetch_historical_data_sync, instrument_key, interval)

    def _fetch_historical_data_sync(self, instrument_key: str, interval: int) -> pd.DataFrame:
        if interval == 1:
            back_days = 5
        else:
            back_days = 25
        today = datetime.date.today()
        yesterday = today - datetime.timedelta(days=1)
        end_date = yesterday.strftime('%Y-%m-%d')
        start = today - datetime.timedelta(days=back_days)
        start_date = start.strftime('%Y-%m-%d')

        url = f"{self.V3_BASE_URL}/historical-candle/{instrument_key}/minutes/{interval}/{end_date}/{start_date}"

        response = requests.get(url, headers=self.v3_headers)

        if response.status_code == 200:
            data = response.json().get('data', {})
            candles = data.get('candles')
            if candles:
                df = pd.DataFrame(candles, columns=['datetime', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                df['datetime'] = pd.to_datetime(df['datetime']).dt.tz_localize(None)
                df.sort_values('datetime', inplace=True)
                df.set_index('datetime', inplace=True)
                df.drop(['volume', 'oi'], axis=1, inplace=True)
                logger.info(f"✅ Fetched historical data from: {start_date}")
                return df
            else:
                logger.warning(f"⚠️ No data on {start_date} (market holiday or no trades). Trying earlier day...")
        else:
            logger.error(
                f"❌ Failed to fetch data for {start_date}. HTTP {response.status_code} and {response.json()}. Retrying...")
        logger.error(f"❗Could not fetch historical data for {instrument_key} from {back_days} days.")
        return pd.DataFrame()

    async def fetch_intraday_data(self, instrument_key: str, interval: int) -> Optional[pd.DataFrame]:
        """Fetches intraday OHLC data for the given instrument and interval."""
        return await asyncio.to_thread(self._fetch_intraday_data_sync, instrument_key, interval)

    def _fetch_intraday_data_sync(self, instrument_key: str, interval: int) -> Optional[pd.DataFrame]:
        # This function needs _round_to_next_interval, which will be in trading_core.py,
        # so for now, we'll keep it as a direct copy or assume it's passed/imported.
        # For simplicity, I'll put a placeholder for _round_to_next_interval here
        # but in a real app, you'd ensure it's accessible or moved.
        def _round_to_next_interval_local(interval_minutes: int, now_dt: datetime.datetime) -> datetime.datetime:
            base = datetime.datetime.combine(now_dt.date(), datetime.time(9, 15))
            elapsed = (now_dt - base).total_seconds()
            if elapsed < 0: return base.replace(microsecond=0)
            intervals_passed = int(elapsed // (interval_minutes * 60)) + 1
            next_interval = base + datetime.timedelta(minutes=intervals_passed * interval_minutes)
            return next_interval.replace(microsecond=0)

        now = datetime.datetime.now()
        next_interval = _round_to_next_interval_local(interval, now)
        present_interval = next_interval - datetime.timedelta(minutes=interval)

        url = f"{self.V3_BASE_URL}/historical-candle/intraday/{instrument_key}/minutes/{interval}"

        max_wait_seconds = 30
        sleep_interval = 5
        waited = 0

        while waited <= max_wait_seconds:
            try:
                response = requests.get(url, headers=self.v3_headers)
                if response.status_code == 200:
                    candles = response.json().get('data', {})
                    if candles:
                        df = pd.DataFrame(candles, columns=['datetime', 'open', 'high', 'low', 'close', 'volume', 'oi'])
                        df['datetime'] = pd.to_datetime(df['datetime']).dt.tz_localize(None)
                        df.sort_values('datetime', inplace=True)
                        df.set_index('datetime', inplace=True)
                        df.drop(['volume', 'oi'], axis=1, inplace=True)
                        latest_candle_time = df.index[-1].replace(second=0, microsecond=0)
                        if latest_candle_time == present_interval:
                            df = df.iloc[:-1]
                        if not df.empty:
                            return df
                        else:
                            logger.warning(f"⏳ Waiting for complete candle data... Retry in {sleep_interval}s")
                    else:
                        logger.warning("⚠️ No candle data found in response.")
                else:
                    logger.error(f"🚨 API Error {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"🚨 Exception in fetch_intraday_data: {e}")

            asyncio.sleep(sleep_interval)  # Use asyncio.sleep here
            waited += sleep_interval

        logger.error("❌ Failed to fetch complete candle data within 30 seconds.")
        return None

    async def fetch_ohlc_1min_data(self, instrument_key: str) -> Optional[dict]:
        """Fetches latest 1-minute OHLC data for the given instrument."""
        return await asyncio.to_thread(self._fetch_ohlc_1min_data_sync, instrument_key)

    def _fetch_ohlc_1min_data_sync(self, instrument_key: str) -> Optional[dict]:
        ist = pytz.timezone('Asia/Kolkata')
        now = datetime.datetime.now(ist)
        retries = 3
        url = f'{self.V3_BASE_URL}/market-quote/ohlc'
        params = {
            "instrument_key": instrument_key,
            "interval": "I1"
        }
        for attempt in range(1, retries + 1):
            try:
                response = requests.get(url, headers=self.v3_headers, params=params)
                if response.status_code == 200:
                    try:
                        json_key = instrument_key.replace('|', ':')
                        data = response.json()['data'][json_key]
                        prev = data['prev_ohlc']
                        if not prev or 'close' not in prev:
                            logger.warning(f"⚠️ OHLC data not yet available (attempt {attempt}/{retries})")
                            asyncio.sleep(1)  # Use asyncio.sleep here
                            continue
                        if now.hour == 9 and now.minute == 15:
                            prev_ts = now.replace(minute=14, second=0, microsecond=0)
                        else:
                            prev_ts = datetime.datetime.fromtimestamp(prev['ts'] / 1000, tz=ist)

                        return {
                            "datetime": prev_ts,
                            "open": prev['open'],
                            "high": prev['high'],
                            "low": prev['low'],
                            "close": prev['close'],
                        }
                    except KeyError as e:
                        logger.error(f"OHLC KeyError in response: {e}")
                        return None
                else:
                    logger.error(f"OHLC Error: {response.status_code}, {response.text}")
                    asyncio.sleep(2)  # Use asyncio.sleep here
                    return None
            except requests.exceptions.RequestException as e:
                logger.error(f"🔌 OHLC Network error (attempt {attempt}/{retries}): {e}")
            asyncio.sleep(1)  # Use asyncio.sleep here
        return None

    async def fetch_live_option_value(self, instrument_key: str) -> Optional[float]:
        """Fetches live option close price."""
        return await asyncio.to_thread(self._fetch_live_option_value_sync, instrument_key)

    def _fetch_live_option_value_sync(self, instrument_key: str) -> Optional[float]:
        url = f'{self.V3_BASE_URL}/market-quote/ohlc'
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {self.access_token}'
        }
        data = {
            "instrument_key": instrument_key,
            "interval": "1d"
        }
        response = requests.get(url, headers=headers, params=data)
        if response.status_code == 200:
            json_data = response.json()
            if 'data' in json_data:
                token_key = instrument_key.replace('|', ':')  # Adjust key if needed for response parsing
                instrument_data = json_data['data'].get(token_key, {})
                close_price = instrument_data.get('live_ohlc', {}).get('close', None)
                if close_price is not None:
                    return float(close_price)
                else:
                    logger.warning(f"Close price not available for {instrument_key}.")
            else:
                logger.warning("No data field in response.")
        else:
            logger.error(f"Request failed with status code: {response.status_code}")
        return None

    async def fetch_positions(self) -> list:
        """Fetches current open positions."""
        return await asyncio.to_thread(self._fetch_positions_sync, self.access_token)

    def _fetch_positions_sync(self, access_token: str) -> list:
        url = 'https://api.upstox.com/v2/portfolio/short-term-positions'
        headers = {
            'Accept': 'application/json',
            'Authorization': f'Bearer {access_token}'
        }
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            positions = response.json().get('data', [])
            return positions
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch positions: {e}")
            return []

    async def place_order(self, instrument_token: str, quantity: int, transaction_type: str, price: float):
        """Places a single order."""
        await asyncio.to_thread(self._place_order_sync, instrument_token, quantity, transaction_type, price)

    def _place_order_sync(self, instrument_token: str, quantity: int, transaction_type: str, price: float):
        quantity = abs(quantity)
        order_type = "MARKET" if price == 0 else "LIMIT"
        url = 'https://api-hft.upstox.com/v3/order/place'
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': f"Bearer {self.access_token}",
        }
        data = {
            'quantity': quantity,
            'product': 'D',
            'validity': 'DAY',
            'price': price,
            'tag': 'AstyaTrade',
            'instrument_token': instrument_token,
            'order_type': order_type,
            'transaction_type': transaction_type,
            'disclosed_quantity': 0,
            'trigger_price': 0,
            'is_amo': False,
            'slice': False
        }
        try:
            response = requests.post(url, json=data, headers=headers)
            if response.status_code == 200:
                message = "Order placed successfully" if transaction_type == "BUY" else "Old option position closed successfully"
                logger.info(message)
            else:
                logger.error(
                    f"Order placed not successful. Response code: {response.status_code}, Response: {response.text}")
        except Exception as e:
            logger.error(f"Error placing order: {e}")

    async def get_option_instrument_key(self, spot_value: float, option_type: str, index_name: str, interval: int) -> \
    Optional[Dict[str, Any]]:
        """
        Asynchronously fetches option data and determines the instrument key, lot size, and expiry date
        using the Upstox instrument master CSV.
        """
        return await asyncio.to_thread(self._get_option_instrument_key_sync, spot_value, option_type, index_name,
                                       interval)

    def _get_option_instrument_key_sync(self, spot_value: float, option_type: str, index_name: str, interval: int) -> \
    Optional[Dict[str, Any]]:
        """
        Synchronous helper to fetch option data and determine instrument key, lot size, and expiry date
        from the Upstox instrument master CSV.
        """
        instruments_df = asyncio.run(self._load_instruments_df())  # Ensure DF is loaded
        if instruments_df is None:
            return None

        if index_name == "NIFTY":
            step = 50
        elif index_name == "BANKNIFTY":
            step = 100
        elif index_name == "FINNIFTY":
            step = 50
        elif index_name == "MIDCPNIFTY":
            step = 25
        else:
            logger.error(f"Unsupported index name for option data: {index_name}")
            return None

        strike = round(round(spot_value / step) * step)

        today = datetime.datetime.now().date()

        filtered = instruments_df[
            (instruments_df['instrument_type'] == 'OPTIDX') &  # Option Index
            (instruments_df['name'] == index_name) &  # e.g., NIFTY, BANKNIFTY
            (instruments_df['expiry'] >= today) &  # Expiry is today or in future
            (instruments_df['strike'] == strike) &  # Matching strike price
            (instruments_df['option_type'] == option_type)  # CE or PE
            ]

        if filtered.empty:
            logger.warning(f"❌ No matching option instrument found for {index_name} {strike}{option_type}")
            return None

        filtered = filtered.sort_values('expiry')

        first_expiry_data = filtered.iloc[0]
        first_expiry_date = first_expiry_data['expiry']
        option_data = first_expiry_data

        if first_expiry_date == today:
            logger.warning(f"⚠️ First expiry ({first_expiry_date}) is today. Fetching next expiry instead.")
            if len(filtered) >= 2:
                option_data = filtered.iloc[1]
                first_expiry_date = option_data['expiry']
            else:
                logger.error("❌ No further expiry available for the option. Cannot proceed.")
                return None

        if option_data is None:
            logger.error("❌ Could not determine option data after filtering.")
            return None

        instrument_key = option_data['instrument_key']

        lot_size = 0
        if index_name == "NIFTY":
            lot_size = 75
        elif index_name == "BANKNIFTY":
            lot_size = 35
        elif index_name == "FINNIFTY":
            lot_size = 65
        else:
            lot_size = 120  # Assuming MIDCPNIFTY

        return {
            "instrument_key": instrument_key,
            "strike": strike,
            "lot_size": lot_size,
            "expiry_date": first_expiry_date  # Return datetime.date object
        }

    async def get_stock_instrument_details(self, stock_name_for_lookup: str) -> Optional[Dict[str, Any]]:
        """
        Fetches instrument details (like lot_size) for a given stock name from the Upstox CSV.
        Prioritizes filtering by 'name' and then 'instrument_type' (OPTSTK for non-indices, OPTIDX for indices).
        """
        instruments_df = await self._load_instruments_df()
        if instruments_df is None:
            return None

        # Determine if the stock name is one of the predefined indices
        is_index = stock_name_for_lookup in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]

        # Filter by 'name' column first
        filtered_by_name = instruments_df[
            (instruments_df['name'] == stock_name_for_lookup)
        ]

        filtered_instruments = pd.DataFrame()  # Initialize an empty DataFrame

        if is_index:
            # For indices, look for 'OPTIDX' (Option Index) in NSE_FO exchange
            filtered_instruments = filtered_by_name[
                (filtered_by_name['instrument_type'] == 'OPTIDX') &
                (filtered_by_name['exchange'] == 'NSE_FO')
                ]
            # If no OPTIDX found, try 'IND' for spot indices (though lot_size might not be trading relevant for these)
            if filtered_instruments.empty:
                filtered_instruments = filtered_by_name[
                    (filtered_by_name['instrument_type'] == 'IND') &
                    (filtered_by_name['exchange'] == 'NSE_INDEX')
                    ]
        else:
            # For non-indices (equities), look for 'OPTSTK' (Option Stock) in NSE_FO exchange
            filtered_instruments = filtered_by_name[
                (filtered_by_name['instrument_type'] == 'OPTSTK') &
                (filtered_by_name['exchange'] == 'NSE_FO')
                ]
            # If no OPTSTK found, try 'EQ' (Equity) in NSE exchange
            if filtered_instruments.empty:
                filtered_instruments = filtered_by_name[
                    (filtered_by_name['instrument_type'] == 'EQ') &
                    (filtered_by_name['exchange'] == 'NSE')
                    ]

        if not filtered_instruments.empty:
            # For options (OPTSTK, OPTIDX), sort by expiry to potentially get a relevant lot size.
            # For EQ, the first row should be sufficient.
            if 'expiry' in filtered_instruments.columns and filtered_instruments['instrument_type'].isin(
                    ['OPTSTK', 'OPTIDX']).any():
                # Filter out expired contracts if we're looking for active F&O lot sizes
                today = datetime.datetime.now().date()
                filtered_instruments = filtered_instruments[filtered_instruments['expiry'] >= today].sort_values(
                    'expiry')
                if filtered_instruments.empty:
                    logger.warning(
                        f"No active F&O instruments found for {stock_name_for_lookup}. Trying other instrument types.")
                    # Fallback to pure EQ if F&O expired or not found
                    filtered_instruments = instruments_df[
                        (instruments_df['name'] == stock_name_for_lookup) &
                        (instruments_df['instrument_type'] == 'EQ') &
                        (instruments_df['exchange'] == 'NSE')
                        ]

            if not filtered_instruments.empty:
                first_row = filtered_instruments.iloc[0]
                lot_size = first_row.get('lot_size')

                # Default lot_size for EQ if not present or NaN
                if first_row.get('instrument_type') == 'EQ' and (pd.isna(lot_size) or lot_size == 0):
                    lot_size = 1
                # Default lot_size for IND (spot indices) if not present or NaN
                elif first_row.get('instrument_type') == 'IND' and (pd.isna(lot_size) or lot_size == 0):
                    lot_size = 1
                elif pd.isna(lot_size) or lot_size == 0:
                    # Fallback for F&O if lot_size is missing (unlikely but for robustness)
                    logger.warning(
                        f"Lot size missing or zero in CSV for {stock_name_for_lookup}, instrument_type: {first_row.get('instrument_type')}. Defaulting to 1.")
                    lot_size = 1

                return {
                    "instrument_key": first_row.get('instrument_key'),
                    "trading_symbol": first_row.get('tradingsymbol'),
                    "lot_size": int(lot_size),  # Ensure integer
                    "instrument_type": first_row.get('instrument_type')
                }

        logger.warning(
            f"Could not find specific instrument details for stock name: {stock_name_for_lookup} with specified filters.")
        # Final fallback to default lot size 1 if nothing is found
        return {"lot_size": 1, "instrument_key": None, "trading_symbol": stock_name_for_lookup,
                "instrument_type": "UNKNOWN"}

