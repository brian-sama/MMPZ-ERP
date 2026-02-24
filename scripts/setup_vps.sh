#!/bin/bash

# VPS Initial Setup Script for MMPZ System
# This script creates a new user, gives sudo rights, and configures UFW.

# Variables
USERNAME="brian"
IP_ADDRESS="89.116.26.24"

echo "------------------------------------------------"
echo "Starting VPS Setup for user: $USERNAME"
echo "------------------------------------------------"

# 1. Create User
echo "Creating user $USERNAME..."
adduser $USERNAME

# 2. Add to Sudo group
echo "Adding $USERNAME to sudo group..."
usermod -aG sudo $USERNAME

# 3. Configure Firewall (UFW)
echo "Configuring UFW..."
ufw allow OpenSSH
echo "y" | ufw enable

# 4. Check Status
echo "------------------------------------------------"
echo "Setup Complete!"
echo "Current UFW Status:"
ufw status
echo "------------------------------------------------"
echo "Next Steps:"
echo "1. Log out: exit"
echo "2. Log back in as $USERNAME: ssh $USERNAME@$IP_ADDRESS"
echo "3. Follow VPS_SETUP_GUIDE.md for remaining steps."
echo "------------------------------------------------"
