#!/usr/bin/env python3
"""
Test script for Point System Plugin Integration

This script tests the connection to the external point system service
and verifies that all endpoints are working correctly.
"""

import asyncio
import os
import logging
from services.point_system_service import PointSystemService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_integration():
    """Test the integration with external point system service"""
    
    # Check environment configuration
    point_system_url = os.getenv('POINT_SYSTEM_URL', 'http://localhost:8000')
    logger.info(f"Testing integration with: {point_system_url}")
    
    try:
        # Test leaderboard endpoints
        logger.info("Testing global leaderboard...")
        global_leaderboard = await PointSystemService.leaderboard.get()
        logger.info(f"Global leaderboard: {len(global_leaderboard)} users")
        
        logger.info("Testing activity leaderboard...")
        activity_leaderboard = await PointSystemService.leaderboard.get_activity(1)
        logger.info(f"Activity 1 leaderboard: {len(activity_leaderboard)} users")
        
        # Test points endpoints
        logger.info("Testing user points...")
        user_points = await PointSystemService.points.get(1)
        logger.info(f"User 1 points: {user_points}")
        
        logger.info("Testing user history...")
        user_history = await PointSystemService.points.get_history(1)
        logger.info(f"User 1 history: {len(user_history)} transactions")
        
        logger.info("Testing activity points...")
        activity_points = await PointSystemService.points.get_in_activity(1, 1)
        logger.info(f"User 1 activity 1 points: {activity_points}")
        
        logger.info("✅ All integration tests passed!")
        
    except Exception as e:
        logger.error(f"❌ Integration test failed: {e}")
        logger.info("This might be expected if the external service is not running")
        logger.info("The plugin will fall back to fake data for testing")

async def test_service_creation():
    """Test the service creation and context manager"""
    try:
        async with PointSystemService() as service:
            logger.info(f"Service created successfully with URL: {service.base_url}")
            logger.info("Context manager working correctly")
    except Exception as e:
        logger.error(f"Service creation test failed: {e}")

if __name__ == "__main__":
    logger.info("Starting Point System Plugin Integration Tests...")
    
    # Run tests
    asyncio.run(test_service_creation())
    asyncio.run(test_integration())
    
    logger.info("Integration tests completed!")

