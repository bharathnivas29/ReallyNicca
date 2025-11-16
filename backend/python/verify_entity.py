#!/usr/bin/env python3
"""
WikiData Entity Verification
Lazy lookup for low-confidence entities
"""

import sys
import json
import requests

def query_wikidata(entity_text):
    """Query WikiData for entity validation"""
    try:
        # Search WikiData
        search_url = "https://www.wikidata.org/w/api.php"
        params = {
            'action': 'wbsearchentities',
            'search': entity_text,
            'language': 'en',
            'format': 'json',
            'limit': 1
        }
        
        response = requests.get(search_url, params=params, timeout=3)
        data = response.json()
        
        if not data.get('search'):
            return {"type": None, "confidence": 0, "reason": "Not found in WikiData"}
        
        entity_id = data['search'][0]['id']
        label = data['search'][0]['label']
        description = data['search'][0].get('description', '')
        
        # Get entity data
        entity_url = f"https://www.wikidata.org/wiki/Special:EntityData/{entity_id}.json"
        response = requests.get(entity_url, timeout=3)
        entity_data = response.json()
        
        claims = entity_data['entities'][entity_id].get('claims', {})
        
        # Determine type from instance_of (P31)
        if 'P31' in claims:
            instance_values = []
            for claim in claims['P31']:
                if 'datavalue' in claim['mainsnak']:
                    instance_values.append(claim['mainsnak']['datavalue']['value']['id'])
            
            # Map WikiData classes
            if 'Q5' in instance_values:
                return {"type": "PERSON", "confidence": 0.97, "reason": f"WikiData: {label} ({description})"}
            elif any(v in ['Q4830453', 'Q43229', 'Q783794'] for v in instance_values):
                return {"type": "ORG", "confidence": 0.97, "reason": f"WikiData: {label} ({description})"}
            elif any(v in ['Q515', 'Q6256', 'Q618123'] for v in instance_values):
                return {"type": "GPE", "confidence": 0.97, "reason": f"WikiData: {label} ({description})"}
            elif any(v in ['Q2424752', 'Q478798'] for v in instance_values):
                return {"type": "PRODUCT", "confidence": 0.97, "reason": f"WikiData: {label} ({description})"}
        
        return {"type": None, "confidence": 0, "reason": f"WikiData found but unclear type: {label} ({description})"}
    
    except Exception as e:
        return {"type": None, "confidence": 0, "reason": f"WikiData error: {str(e)}"}

def main():
    entity_text = sys.stdin.read().strip()
    result = query_wikidata(entity_text)
    print(json.dumps(result))

if __name__ == "__main__":
    main()
