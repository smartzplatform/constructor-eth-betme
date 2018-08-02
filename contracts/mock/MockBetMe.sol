pragma solidity ^0.4.24;

import '../BetMe.sol';

contract MockBetMe is BetMe {
	uint256 public _time;
	function getTime() public view returns (uint256) {
		if (_time > 0) {
			return _time;
		}
		return now;
	}
	function setTime(uint256 _val) public {
		 _time = _val;
	}

	function () public payable {}

	constructor(
		string  _assertion,
		uint256 _deadline,
		uint256 _fee,
		address _arbiterAddr,
		address _opponentAddr,
		uint256 _arbiterPenaltyAmount
	) public 
		BetMe(
		_assertion,
		_deadline,
		_fee,
		_arbiterAddr,
		_opponentAddr,
		_arbiterPenaltyAmount
		)
	{
	}
}
