/**
 * RentIQ Frontend AI Service
 *
 * File: frontend/src/api/aiService.js
 */

import axiosInstance from './axiosInstance';

export const sendChatMessage = async (message, history = []) => {
    const response = await axiosInstance.post('/ai/chat', {
        message,
        history
    });
    return response.data;
};

export const getSuggestedQuestions = async () => {
    const response = await axiosInstance.get('/ai/suggestions');
    return response.data?.suggestions || [];
};

export const getVehicleRecommendations = async (preferences = {}) => {
    const response = await axiosInstance.post('/ai/recommend', preferences);
    return response.data;
};

export default {
    sendChatMessage,
    getSuggestedQuestions,
    getVehicleRecommendations
};
