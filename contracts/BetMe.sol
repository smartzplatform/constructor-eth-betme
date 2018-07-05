pragma solidity ^0.4.24;

contract BetMe {

	string public Assertion;
	uint256 public Deadline;
	uint256 public ArbiterFee;
	address public ArbiterAddress;
	address public OpponentAddress;

	constructor(
		string  _assertion,
		uint256 _deadline,
		uint256 _fee,
		address _arbiterAddr,
		address _opponentAddr
	) public {
		Assertion       = _assertion;
		Deadline        = _deadline;
		ArbiterFee      = _fee;
		ArbiterAddress  = _arbiterAddr;
		OpponentAddress = _opponentAddr;
	}


	function getDate() public view returns (uint256) {
		return now;
	}

}
