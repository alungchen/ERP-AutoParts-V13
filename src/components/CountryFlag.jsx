import React from 'react';

const COUNTRY_CODES = {
    Japan: 'jp',
    Germany: 'de',
    Taiwan: 'tw',
    China: 'cn',
    'South Korea': 'kr',
    USA: 'us',
    Thailand: 'th',
    Vietnam: 'vn'
};

const CountryFlag = ({ country, size = 16, style = {} }) => {
    const code = COUNTRY_CODES[country];
    if (!code) return <span style={{ fontSize: `${size}px`, marginRight: '6px' }}>🌐</span>;

    return (
        <img
            src={`https://flagcdn.com/w40/${code}.png`}
            width={size * 1.5}
            alt={country}
            style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                borderRadius: '2px',
                marginRight: '6px',
                objectFit: 'contain',
                ...style
            }}
        />
    );
};

export default CountryFlag;
