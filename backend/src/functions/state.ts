import express from 'express';
import { AppState } from './types';

export const state: AppState = {
    app: express(),
    browser: null,
    page: null,
    isInitialized: false,
    isActive: true,
    requestQueue: [],
    isProcessing: false,
};
