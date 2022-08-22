import styled from 'styled-components/macro';

export const FlexBox = styled.div`
  width: 100%;
  margin: 8px;
  display: flex;
  padding: ${props => props.padding || " 8px 16px"};
  flex-direction: ${props => props.direction || "row"};
  justify-content: ${props => props.justifyContent || "flex-start"};
  align-items: ${props => props.alignItems || "center"};
`;