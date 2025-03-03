
/*****************************************************************************
#                                                                            #
#    blikvm                                                                  #
#                                                                            #
#    Copyright (C) 2021-present     blicube <info@blicube.com>               #
#                                                                            #
#    This program is free software: you can redistribute it and/or modify    #
#    it under the terms of the GNU General Public License as published by    #
#    the Free Software Foundation, either version 3 of the License, or       #
#    (at your option) any later version.                                     #
#                                                                            #
#    This program is distributed in the hope that it will be useful,         #
#    but WITHOUT ANY WARRANTY; without even the implied warranty of          #
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           #
#    GNU General Public License for more details.                            #
#                                                                            #
#    You should have received a copy of the GNU General Public License       #
#    along with this program.  If not, see <https://www.gnu.org/licenses/>.  #
#                                                                            #
*****************************************************************************/
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

export const CONFIG_PATH = process.argv[2] ? process.argv[2] : 'config/app.json';
console.log(`Config path is: ${CONFIG_PATH}`);
export const UTF8 = 'utf8';
export const BliKVMSwitchV1ModuleName = 'BliKVM_switch_v1';
export const BliKVMSwitchV2ModuleName = 'BliKVM_switch_v2';
export const JWT_SECRET = crypto.randomBytes(32).toString('hex');