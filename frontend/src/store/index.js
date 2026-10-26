import { configureStore } from '@reduxjs/toolkit';
import compareReducer from './slices/compareSlice';

export const store = configureStore({
    reducer: {
        compare: compareReducer
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        })
});

export default store;
