import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../config/theme';

// Receptionist Screens
import ReceptionistDashboardScreen from '../screens/receptionist/ReceptionistDashboardScreen';
import AppointmentManagementScreen from '../screens/receptionist/AppointmentManagementScreen';
import PatientRegistrationScreen from '../screens/receptionist/PatientRegistrationScreen';
import ReceptionistProfileScreen from '../screens/receptionist/ReceptionistProfileScreen';
import NotificationsScreen from '../screens/receptionist/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator for Receptionist
const ReceptionistTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'apps' : 'apps-outline';
          } else if (route.name === 'Appointments') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        headerShown: false,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60
        }
      })}
    >
      <Tab.Screen name="Dashboard" component={ReceptionistDashboardScreen} />
      <Tab.Screen name="Appointments" component={AppointmentManagementScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ReceptionistProfileScreen} />
    </Tab.Navigator>
  );
};

// Stack Navigator for Receptionist
const ReceptionistStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="ReceptionistTabs" 
        component={ReceptionistTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PatientRegistration" 
        component={PatientRegistrationScreen}
        options={{ 
          title: 'Register Patient',
          headerStyle: { backgroundColor: Colors.primary },
          headerTintColor: Colors.white
        }}
      />
    </Stack.Navigator>
  );
};

export default ReceptionistStack;
