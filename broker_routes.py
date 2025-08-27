# backend/app/routes/broker_routes.py
from fastapi import APIRouter, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
import logging
import asyncio

# Import your broker adapters
from ..brokers.upstox import UpstoxBroker
from ..brokers.angel_one import AngelOneBroker
from ..brokers.zerodha import ZerodhaBroker

# Import the new generalized trading logic
# If your IDE still shows a "red underline" here, please ensure that:
# 1. 'backend/app/' contains an empty file named '__init__.py'.
# 2. 'backend/app/core/' contains an empty file named '__init__.py'.
# 3. 'backend/app/trading/' contains an empty file named '__init__.py'.
# 4. Your IDE (e.g., VS Code) is configured to recognize 'backend/app/' as a source root.
from ..trading.trading_core import start_trading_session

active_broker_connections: Dict[str, Any] = {}  # Key: user_id:broker_name, Value: broker_instance

# To manage running trade tasks
# Key: user_id:broker_name:instrument_key_index:interval, Value: asyncio.Task
active_trade_tasks: Dict[str, asyncio.Task] = {}

logger = logging.getLogger(__name__)
router = APIRouter()


# Pydantic models for request bodies
class ConnectRequest(BaseModel):
    broker_name: str
    upstoxAccessToken: Optional[str] = None
    angelApiKey: Optional[str] = None
    angelClientCode: Optional[str] = None
    angelPin: Optional[str] = None
    angelTotpSecret: Optional[str] = None
    zerodhaApiKey: Optional[str] = None
    zerodhaAccessToken: Optional[str] = None


class BrokerStatus(BaseModel):
    is_connected: bool
    broker_name: str
    user_id: str = "N/A"
    user_name: str = "N/A"
    user_email: str = "N/A"
    total_balance: str = "N/A"
    margin_used: str = "N/A"
    available_balance: str = "N/A"


class StartTradeRequest(BaseModel):
    broker_name: str
    instrument_key_index: str  # e.g., "NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank"
    index_name: str  # e.g., "NIFTY", "BANKNIFTY" (used by trading script)
    interval: int  # Candle interval in minutes (e.g., 5, 15)
    lots: int  # Number of lots to trade


class TradeActionResponse(BaseModel):
    message: str
    task_id: Optional[str] = None
    status: str = "pending"  # "running", "stopped", "finished", "error", "not_running"


class InstrumentDetailsRequest(BaseModel):
    broker_name: str
    stock_name_for_lookup: str  # Updated from stock_ticker to stock_name_for_lookup


class InstrumentDetailsResponse(BaseModel):
    lot_size: int
    instrument_key: Optional[str] = None
    trading_symbol: Optional[str] = None
    instrument_type: Optional[str] = None


@router.post("/connect", response_model=BrokerStatus)
async def connect_broker(request: ConnectRequest):
    user_id = "mock_user_123"  # Replace with actual user ID from authentication
    connection_key = f"{user_id}:{request.broker_name}"

    try:
        broker_instance = None
        if request.broker_name == "Upstox":
            if not request.upstoxAccessToken:
                raise HTTPException(status_code=400, detail="Upstox Access Token is required.")
            broker_instance = UpstoxBroker(access_token=request.upstoxAccessToken)
        elif request.broker_name == "AngelOne":
            if not (request.angelApiKey and request.angelClientCode and request.angelPin and request.angelTotpSecret):
                raise HTTPException(status_code=400,
                                    detail="Angel One: API Key, Client Code, PIN, and TOTP Secret are required.")
            broker_instance = AngelOneBroker(
                api_key=request.angelApiKey,
                client_code=request.angelClientCode,
                pin=request.angelPin,
                totp_secret=request.angelTotpSecret
            )
            await broker_instance.generate_session()
        elif request.broker_name == "Zerodha":
            if not (request.zerodhaApiKey and request.zerodhaAccessToken):
                raise HTTPException(status_code=400, detail="Zerodha: API Key and Access Token are required.")
            broker_instance = ZerodhaBroker(
                api_key=request.zerodhaApiKey,
                access_token=request.zerodhaAccessToken
            )
            await broker_instance.generate_session()
        else:
            raise HTTPException(status_code=400, detail="Unsupported broker selected.")

        active_broker_connections[connection_key] = broker_instance
        logger.info(f"Broker connection for {connection_key} established.")

        profile = await broker_instance.fetch_profile()
        balance = await broker_instance.fetch_balance()

        return BrokerStatus(
            is_connected=True,
            broker_name=request.broker_name,
            user_id=profile["userId"],
            user_name=profile["name"],
            user_email=profile["email"],
            total_balance=balance["totalBalance"],
            margin_used=balance["marginUsed"],
            available_balance=balance["availableBalance"]
        )

    except HTTPException as e:
        logger.error(f"HTTP Error connecting to {request.broker_name}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error connecting to {request.broker_name}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during connection: {e}")


@router.post("/trade/start", response_model=TradeActionResponse)
async def start_trade(request: StartTradeRequest, background_tasks: BackgroundTasks):
    user_id = "mock_user_123"
    connection_key = f"{user_id}:{request.broker_name}"
    trade_task_id = f"{connection_key}:{request.instrument_key_index}:{request.interval}"

    if trade_task_id in active_trade_tasks and not active_trade_tasks[trade_task_id].done():
        raise HTTPException(status_code=409,
                            detail=f"A trading session for {request.instrument_key_index} at {request.interval}-min interval is already running.")

    broker_instance = active_broker_connections.get(connection_key)
    if not broker_instance:
        raise HTTPException(status_code=400,
                            detail=f"Broker {request.broker_name} not connected for user {user_id}. Please connect first.")

    required_methods = [
        'fetch_historical_data', 'fetch_intraday_data', 'fetch_ohlc_1min_data',
        'fetch_live_option_value', 'fetch_positions', 'place_order', 'get_option_instrument_key',
        'get_stock_instrument_details'  # Added for dynamic lot size lookup
    ]
    for method_name in required_methods:
        if not hasattr(broker_instance, method_name):
            raise HTTPException(
                status_code=400,
                detail=f"Broker '{request.broker_name}' does not support trading functionality: missing method '{method_name}'."
            )

    try:
        task = asyncio.create_task(
            start_trading_session(
                broker_adapter=broker_instance,  # Pass the entire broker instance
                index_name=request.index_name,
                instrument_key_index=request.instrument_key_index,
                interval=request.interval,
                lots=request.lots
            )
        )
        active_trade_tasks[trade_task_id] = task
        logger.info(f"Started trading session for {trade_task_id}")
        return TradeActionResponse(
            message=f"Trading session for {request.instrument_key_index} started in the background.",
            task_id=trade_task_id, status="running")
    except Exception as e:
        logger.error(f"Failed to start trading session for {trade_task_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error during trading session start: {e}")


@router.post("/trade/stop", response_model=TradeActionResponse)
async def stop_trade(request: StartTradeRequest):
    user_id = "mock_user_123"
    connection_key = f"{user_id}:{request.broker_name}"
    trade_task_id = f"{connection_key}:{request.instrument_key_index}:{request.interval}"

    task = active_trade_tasks.get(trade_task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"No running trading session found for {trade_task_id}.")

    if not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            logger.info(f"Trading session {trade_task_id} successfully cancelled.")
        except Exception as e:
            logger.error(f"Error during task cancellation for {trade_task_id}: {e}", exc_info=True)
            return TradeActionResponse(
                message=f"Failed to gracefully stop trading session {request.instrument_key_index}.",
                task_id=trade_task_id, status="error")
        finally:
            del active_trade_tasks[trade_task_id]
        return TradeActionResponse(message=f"Trading session for {request.instrument_key_index} stopped.",
                                   task_id=trade_task_id, status="stopped")
    else:
        del active_trade_tasks[trade_task_id]
        return TradeActionResponse(message=f"Trading session for {request.instrument_key_index} was already finished.",
                                   task_id=trade_task_id, status="finished")


@router.get("/trade/status/{broker_name}/{instrument_key_index}/{interval}", response_model=TradeActionResponse)
async def get_trade_status(broker_name: str, instrument_key_index: str, interval: int):
    user_id = "mock_user_123"
    trade_task_id = f"{user_id}:{broker_name}:{instrument_key_index}:{interval}"
    task = active_trade_tasks.get(trade_task_id)

    if not task:
        return TradeActionResponse(message=f"No active trading session found for {instrument_key_index}.",
                                   task_id=trade_task_id, status="not_running")

    if task.done():
        try:
            await task
            status_message = "finished"
        except asyncio.CancelledError:
            status_message = "cancelled"
        except Exception:
            status_message = "failed"
        finally:
            del active_trade_tasks[trade_task_id]
        return TradeActionResponse(message=f"Trading session for {instrument_key_index} {status_message}.",
                                   task_id=trade_task_id, status=status_message)
    else:
        return TradeActionResponse(message=f"Trading session for {instrument_key_index} is running.",
                                   task_id=trade_task_id, status="running")


@router.post("/instrument-details", response_model=InstrumentDetailsResponse)
async def get_instrument_details(request: InstrumentDetailsRequest):
    # For lot size lookup, we will always use the Upstox instrument data
    # as it's a publicly available CSV and provides comprehensive details.
    # We create a temporary UpstoxBroker instance for this purpose.
    # A dummy access token is sufficient as we're not performing authenticated operations.
    upstox_lot_size_broker = UpstoxBroker(access_token="dummy_access_token_for_lot_size_lookup")

    try:
        details = await upstox_lot_size_broker.get_stock_instrument_details(request.stock_name_for_lookup)
        if details:
            return InstrumentDetailsResponse(
                lot_size=details.get("lot_size", 1),  # Default to 1 if not found
                instrument_key=details.get("instrument_key"),
                trading_symbol=details.get("trading_symbol"),
                instrument_type=details.get("instrument_type")
            )
        else:
            raise HTTPException(status_code=404,
                                detail=f"Instrument details not found for {request.stock_name_for_lookup} using Upstox data.")
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error fetching instrument details for {request.stock_name_for_lookup} using Upstox data: {e}",
                     exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error fetching instrument details: {e}")

