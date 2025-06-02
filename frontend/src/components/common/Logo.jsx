import React from 'react';
import { Box, Text, HStack, Icon } from '@chakra-ui/react';
import { FaSlack } from 'react-icons/fa';
import { RiRobot2Fill } from 'react-icons/ri';

const Logo = ({ size = "md" }) => {
  const sizes = {
    sm: {
      boxSize: "32px",
      fontSize: "lg",
      iconSize: 4
    },
    md: {
      boxSize: "48px",
      fontSize: "xl",
      iconSize: 5
    },
    lg: {
      boxSize: "64px",
      fontSize: "2xl",
      iconSize: 6
    }
  };

  return (
    <Box
      w={sizes[size].boxSize}
      h={sizes[size].boxSize}
      bg="blue.500"
      borderRadius="md"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      <Icon 
        as={FaSlack} 
        color="white" 
        boxSize={sizes[size].iconSize} 
      />
      <Box
        position="absolute"
        bottom="-2px"
        right="-2px"
        bg="green.400"
        borderRadius="full"
        p="1"
      >
        <Icon 
          as={RiRobot2Fill} 
          color="white" 
          boxSize={sizes[size].iconSize - 2} 
        />
      </Box>
    </Box>
  );
};

export default Logo; 