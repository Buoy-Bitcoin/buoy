#!/usr/bin/env python3
"""Draws the QR code for the Lightning address in data/services.json into images/v4v-qr.svg.
Run it again whenever the address changes:  python3 tools/make_qr.py   (needs: pip install segno)"""
import json, os, segno
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
addr = json.load(open(os.path.join(root, 'data', 'services.json')))['v4v']['address']
segno.make('lightning:' + addr, error='m').save(os.path.join(root, 'images', 'v4v-qr.svg'), border=0, dark='#16202C', light=None, xmldecl=False, svgns=True, nl=False)
print('QR code written for', addr)
