// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

library StringArray {
    function fromArray1(
        string[1] memory array
    ) internal pure returns (string[] memory) {
        require(array.length == 1, "array length != 1");

        string[] memory array2 = new string[](1);
        array2[0] = array[0];

        return array2;
    }

    function fromArray3(
        string[3] memory array
    ) internal pure returns (string[] memory) {
        require(array.length == 3, "array length != 3");

        string[] memory array2 = new string[](3);
        for (uint i = 0; i < array.length; i++) {
            array2[i] = array[i];
        }
        return array2;
    }

    function fromArray5(
        string[5] memory array
    ) internal pure returns (string[] memory) {
        require(array.length == 5, "array length != 5");

        string[] memory array2 = new string[](5);
        for (uint i = 0; i < array.length; i++) {
            array2[i] = array[i];
        }
        return array2;
    }
}
