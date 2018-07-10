pragma solidity ^0.4.24;

import "./BetMe.sol";

contract UnpayableArbiter {
	BetMe _betContract;

	constructor(BetMe _addr) public {
		setBetContract(_addr);
	}

	function setBetContract(BetMe _addr) public {
		_betContract = _addr;
	}

	function agreeToBecameArbiter() public payable {
		uint256 _stateNumber = _betContract.StateVersion();
		_betContract.agreeToBecameArbiter.value(msg.value)(_stateNumber);
	}

	function arbiterSelfRetreat() public {
		_betContract.arbiterSelfRetreat();
	}

	function () public {
		revert();
	}
}
