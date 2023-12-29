const axios = require('axios');
const devConfig = require('../../config/env/development');
const prodConfig = require('../../config/env/production');

const BASE_URL = process.env.SUBDOMAINS === 'app,api.app,wiki' && process.env === 'cboard.io'
    ? prodConfig.PAYPAL_API_URL + 'v1'
    : devConfig.PAYPAL_API_URL;

const getAccessToken = async () => {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    const auth = {
        username: process.env.PAYPAL_API_CLIENT_ID || '',
        password: process.env.PAYPAL_API_CLIENT_SECRET || '',
    };
    let res = '';
    try {
        res = await axios.post(BASE_URL + '/oauth2/token',
            new URLSearchParams({
                'grant_type': 'client_credentials'
            }), { auth }
        );
    } catch (err) {
        console.log('Error getting PayPal access token: ', err.message);
        return res;
    }
    return res.data.access_token;
};

module.exports = class Paypal {
    constructor(config = {}) {
        this.axiosInstance = axios.create({
            baseURL: BASE_URL,
            ...config
        });
    }

    async getSubscriptionDetails(subscriptionId) {
        const authToken = await getAccessToken();
        const headers = {
            Authorization: `Bearer ${authToken}`
        };
        const { data } = await this.axiosInstance.get(`/billing/subscriptions/${subscriptionId}`, {
            headers
        });
        return data;
    }

    async listPlans() {
        const authToken = await getAccessToken();
        const headers = {
            Authorization: `Bearer ${authToken}`
        };
        const params = new URLSearchParams([
            ['page_size', 10],
            ['page', 1],
            ['total_required', true]
        ]);
        const { data } = await this.axiosInstance.get(`/billing/plans`,
            { headers },
            { params });
        return data;
    }

    async cancelPlan(subscriptionId) {
        const authToken = await getAccessToken();
        const headers = {
            Authorization: `Bearer ${authToken}`
        };
        const data = {
            "reason": "User cancelled"
        };
        const res = await this.axiosInstance.post(`/billing/subscriptions/${subscriptionId}/cancel`,
            { data }, { headers });
        return res.data;
    }
}
