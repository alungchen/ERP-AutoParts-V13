import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';

// Live mock exchange rates relative to TWD base
const initialRates = {
    TWD: 1,
    USD: 31.85,
    EUR: 34.20,
    JPY: 0.21,
    CNY: 4.35
};

const mockSourcingItems = [
    {
        s_id: 'S-2001',
        p_id: 'P-1001',
        name: 'Brake Pad Set - Front (Premium Ceramic)',
        target_part: '04465-02220',
        quotes: [
            {
                q_id: 'Q-001',
                supplierName: 'Akebono Global',
                supplier_id: 'SUP-001',
                currency: 'USD',
                price: 11.50,
                moq: 50,
                leadTime: 14,
                freightTwd: 1500,
                tariffRate: 0.05, // 5%
                isBestValue: true
            },
            {
                q_id: 'Q-002',
                supplierName: 'Brembo Europe AG',
                supplier_id: 'SUP-003',
                currency: 'EUR',
                price: 13.00,
                moq: 200,
                leadTime: 30,
                freightTwd: 3200,
                tariffRate: 0.05,
                isBestValue: false
            },
            {
                q_id: 'Q-003',
                supplierName: 'Taiwan Auto Parts Inc.',
                supplier_id: 'SUP-004',
                currency: 'TWD',
                price: 420.00,
                moq: 10,
                leadTime: 3,
                freightTwd: 200,
                tariffRate: 0,
                isBestValue: false
            }
        ]
    },
    {
        s_id: 'S-2002',
        p_id: 'P-1002',
        name: 'Air Filter Element',
        target_part: '17220-5AA-A00',
        quotes: [
            {
                q_id: 'Q-004',
                supplierName: 'Denso Japan',
                supplier_id: 'SUP-002',
                currency: 'JPY',
                price: 550,
                moq: 100,
                leadTime: 21,
                freightTwd: 800,
                tariffRate: 0.08,
                isBestValue: true
            },
            {
                q_id: 'Q-005',
                supplierName: 'Guangzhou Filter Mfg',
                supplier_id: 'SUP-005',
                currency: 'CNY',
                price: 18.50,
                moq: 500,
                leadTime: 10,
                freightTwd: 400,
                tariffRate: 0.10,
                isBestValue: false
            }
        ]
    }
];

export const useSourcingStore = create(persist((set) => ({
    rates: initialRates,
    sourcingItems: mockSourcingItems,
    generatePo: (quoteId) => {
        console.log(`PO Generated for Quote: ${quoteId}`);
        // In a real app we'd trigger a PO creation workflow
    }
}), { name: 'erp-sourcing-store', storage: erpPersistStorage }));
