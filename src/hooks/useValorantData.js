import { useEffect, useState } from 'react';

export const useValorantData = () => {
    const [agentData, setAgentData] = useState({});
    const [mapImages, setMapImages] = useState({});

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const agentRes = await fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
                const agentJson = await agentRes.json();
                const aMap = {};
                if (agentJson.data) agentJson.data.forEach(agent => {
                    aMap[agent.displayName] = {
                        icon: agent.displayIcon,
                        abilities: agent.abilities.map(a => ({ name: a.displayName, icon: a.displayIcon, slot: a.slot })).filter(a => a.slot !== "Passive" && a.icon)
                    };
                });
                setAgentData(aMap);

                const mapRes = await fetch('https://valorant-api.com/v1/maps');
                const mapJson = await mapRes.json();
                const mMap = {};

                if (mapJson.data) {
                    mapJson.data.forEach(map => {
                        if (map.mainLogAssetGuid !== null && map.assetPath.includes('Maps/')) {
                            mMap[map.displayName] = map.stylizedIcon || map.displayIcon;
                        }
                    });
                }
                setMapImages(mMap);
            } catch (e) {
                console.error("Failed to fetch Valorant assets", e);
            }
        };
        fetchAssets();
    }, []);

    return { agentData, mapImages };
};
